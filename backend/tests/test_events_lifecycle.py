import uuid
from datetime import date, timedelta

import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def login(client, username, password):
    resp = await client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    return resp.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def csv_upload(file_name: str, content: str):
    return {"file": (file_name, content.encode("utf-8"), "text/csv")}


async def create_handover_inquiry(client, token):
    resp = await client.post("/api/inquiries", headers=auth(token), json={
        "client_name": f"Lifecycle {uuid.uuid4().hex[:6]}",
        "client_phone": "9876543210",
        "event_type": "Wedding",
        "event_date": str(date.today() + timedelta(days=5)),
        "pax": 200,
        "venue": "Test Venue",
        "per_plate_rate": 500,
    })
    assert resp.status_code == 201, f"create failed: {resp.status_code} {resp.text}"
    inquiry_id = resp.json()["id"]
    status_resp = await client.patch(f"/api/inquiries/{inquiry_id}/status?new_status=operation_handover", headers=auth(token))
    assert status_resp.status_code == 200, f"status failed: {status_resp.status_code} {status_resp.text}"
    return inquiry_id


async def test_receive_all_and_return_all(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    ingredient = csv_upload("ingredient.csv", "Item Name,Qty,Unit\nPlates,100,pcs\nSpoon,200,pcs\nGlass,150,pcs\n")
    resp = await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=ingredient", headers=auth(token), files=ingredient)
    assert resp.status_code == 200, resp.text

    # no ingredient plan -> 400
    other = await create_handover_inquiry(client, token)
    no_plan = await client.post(f"/api/events/{other}/inventory/receive-all", headers=auth(token))
    assert no_plan.status_code == 400

    # enter not-received counts BEFORE the receive-all bulk action
    await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={"item_name": "Spoon", "field": "not_received_count", "value": 20})
    await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={"item_name": "Glass", "field": "not_received_count", "value": 150})

    recv = await client.post(f"/api/events/{inquiry_id}/inventory/receive-all", headers=auth(token))
    assert recv.status_code == 200, recv.text
    # Glass is a no-op: required=150, not_received=150 -> target 0, old received=0 (0 == 0 -> not updated),
    # so only Plates (0->100) and Spoon (0->180) are updated.
    assert recv.json()["updated"] == 2

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    by_name = {r["item_name"]: r for r in detail["inventory"]}
    assert by_name["Plates"]["received_qty"] == 100
    assert by_name["Plates"]["received_tag"] == "Yes"
    assert by_name["Spoon"]["received_qty"] == 180
    assert by_name["Spoon"]["received_tag"] == "Half"
    assert by_name["Glass"]["received_qty"] == 0
    assert by_name["Glass"]["received_tag"] == "No"

    # transfer_count then return-all
    await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={"item_name": "Spoon", "field": "transfer_count", "value": 50})
    ret = await client.post(f"/api/events/{inquiry_id}/inventory/return-all", headers=auth(token))
    assert ret.status_code == 200, ret.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    by_name = {r["item_name"]: r for r in detail["inventory"]}
    assert by_name["Spoon"]["returned_qty"] == 130  # 200 - 20 - 50

    closure = detail["closure"]
    assert closure["total_required_qty"] == 450
    assert closure["total_received_qty"] == 280
    assert closure["not_received_qty"] == 170
    assert closure["transferred_qty"] == 50
    # return-all covers every plan item: Plates 100 (required 100 - 0 - 0), Spoon 130 (200 - 20 - 50), Glass 0 (no-op).
    assert closure["returned_thol_qty"] == 230
    assert closure["breakage_qty"] == 0
    assert closure["wastage_qty"] == 0
    assert closure["pending_qty"] == 170  # 450 - 280 - 0

    # bulk actions write audit rows with their distinguishing remarks
    audit = (await client.get(f"/api/events/{inquiry_id}/audit", headers=auth(token))).json()
    bulk_actions = [(a["field_name"], a["remark"]) for a in audit if a["action"] == "edit"]
    assert ("received_qty", "Received All Inventory") in bulk_actions
    assert ("returned_qty", "All Items Returned to THOL") in bulk_actions

    # kitchen cannot run bulk actions
    kitchen_token = await login(client, "kitchen@shaguncatering.com", "kitchen123")
    forbidden = await client.post(f"/api/events/{inquiry_id}/inventory/receive-all", headers=auth(kitchen_token))
    assert forbidden.status_code == 403


async def test_breakage_and_audit_trail(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    ingredient = csv_upload("ingredient.csv", "Item Name,Qty,Unit\nPaneer,10,kg\n")
    await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=ingredient", headers=auth(token), files=ingredient)

    await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={"item_name": "Paneer", "field": "breakage_count", "value": 2})
    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    assert detail["inventory"][0]["breakage_count"] == 2
    assert detail["closure"]["breakage_qty"] == 2
    assert detail["closure"]["wastage_qty"] == 2

    # transfer_event is a free-text ops column
    await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={"item_name": "Paneer", "field": "transfer_event", "value": "Mehta wedding"})
    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    assert detail["inventory"][0]["transfer_event"] == "Mehta wedding"

    await client.post(f"/api/events/{inquiry_id}/complete", headers=auth(token))

    # edits locked after completion
    locked = await client.patch(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={"item_name": "Paneer", "field": "breakage_count", "value": 3})
    assert locked.status_code == 400

    # audit trail readable by any role, includes edits, bulk actions, uploads, completion
    audit = (await client.get(f"/api/events/{inquiry_id}/audit", headers=auth(token))).json()
    actions = [(a["action"], a["entity_type"], a["field_name"]) for a in audit]
    assert ("complete", "event", None) in actions
    assert ("edit", "inventory_item", "breakage_count") in actions
    assert ("edit", "inventory_item", "transfer_event") in actions
    assert ("upload", "file", "ingredient") in actions
    assert all(a["user_name"] for a in audit)

    # audit list is scoped per event
    other = await create_handover_inquiry(client, token)
    other_audit = (await client.get(f"/api/events/{other}/audit", headers=auth(token))).json()
    assert len(other_audit) == 0


async def test_vendor_edit_writes_audit(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    vendor = csv_upload("vendor.csv", "Vendor Name,Service Name,Rate,Total Cost,Remark\nABC Catering,Staff,500,15000,staff team\n")
    await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=vendor", headers=auth(token), files=vendor)

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    vendor_id = detail["vendors"][0]["id"]

    ok = await client.post(f"/api/events/{inquiry_id}/vendors", headers=auth(token), json={
        "rows": [{"id": vendor_id, "rate": 600, "total_cost": None, "remark": "rate increased"}]
    })
    assert ok.status_code == 200, ok.text

    audit = (await client.get(f"/api/events/{inquiry_id}/audit", headers=auth(token))).json()
    assert ("edit", "vendor", "rate") in [(a["action"], a["entity_type"], a["field_name"]) for a in audit]


async def test_required_qty_persists_after_reupload(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=ingredient", headers=auth(token), files=csv_upload("i1.csv", "Item Name,Qty,Unit\nPaneer,10,kg\n"))
    await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=ingredient", headers=auth(token), files=csv_upload("i2.csv", "Item Name,Qty,Unit\nPaneer,14,kg\nRice,5,kg\n"))

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    by_name = {r["item_name"]: r for r in detail["inventory"]}
    assert by_name["Paneer"]["required_qty"] == 14
    assert by_name["Rice"]["required_qty"] == 5
