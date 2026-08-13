import os
import uuid
from datetime import date, timedelta
from pathlib import Path

import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/tmp/shagun_test_uploads"))


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


async def create_handover_inquiry(client, token):
    resp = await client.post("/api/inquiries", headers=auth(token), json={
        "client_name": f"Ops Test {uuid.uuid4().hex[:6]}",
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


def csv_upload(file_name: str, content: str):
    return {"file": (file_name, content.encode("utf-8"), "text/csv")}


async def test_events_list_empty(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    resp = await client.get("/api/events", headers=auth(token))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_events_list_and_detail(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    list_resp = await client.get("/api/events", headers=auth(token))
    assert list_resp.status_code == 200
    ids = [e["id"] for e in list_resp.json()]
    assert inquiry_id in ids

    detail_resp = await client.get(f"/api/events/{inquiry_id}", headers=auth(token))
    assert detail_resp.status_code == 200
    data = detail_resp.json()
    assert data["client_name"].startswith("Ops Test")
    assert data["is_completed"] is False
    assert data["inventory"] == []
    assert data["closure"]["total_items"] == 0


async def test_inventory_derivation_and_edits(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    ingredient = csv_upload("ingredient.csv", "Item Name,Qty,Unit\nPaneer,10,kg\nRice,20,kg\n")
    up_resp = await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=ingredient", headers=auth(token), files=ingredient)
    assert up_resp.status_code == 200, up_resp.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    assert len(detail["inventory"]) == 2
    paneer = detail["inventory"][0]
    assert paneer["item_name"] == "Paneer"
    assert paneer["received_qty"] == 0
    assert paneer["received_status"] == "Not Received"
    assert paneer["not_received_count"] == 1

    received = csv_upload("received.csv", "Paneer,6,kg\n")
    rec_resp = await client.post(f"/api/inquiries/{inquiry_id}/inventory-upload?movement_type=received", headers=auth(token), files=received)
    assert rec_resp.status_code == 200, rec_resp.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    paneer = detail["inventory"][0]
    assert paneer["received_qty"] == 6
    assert paneer["received_status"] == "Partial"

    # editing without remark -> 400
    bad = await client.post(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={
        "rows": [{"item_name": "Paneer", "received_qty": 10, "transfer_count": None, "returned_qty": None, "remark": None}]
    })
    assert bad.status_code == 400

    # editing with remark -> ok
    ok = await client.post(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={
        "rows": [{"item_name": "Paneer", "received_qty": 10, "transfer_count": None, "returned_qty": None, "remark": "received extra 4kg"}]
    })
    assert ok.status_code == 200, ok.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    paneer = detail["inventory"][0]
    assert paneer["received_qty"] == 10
    assert paneer["received_status"] == "Received"
    assert paneer["remark"] == "received extra 4kg"


async def test_upload_history_versions(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    for i in range(2):
        resp = await client.post(
            f"/api/inquiries/{inquiry_id}/inventory-upload?movement_type=received",
            headers=auth(token),
            files=csv_upload(f"received_v{i+1}.csv", f"Paneer,{i+1},kg\n"),
        )
        assert resp.status_code == 200, resp.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    history = detail["upload_history"]
    assert len(history) == 2
    versions = sorted(v["version_no"] for v in history)
    assert versions == [1, 2]
    assert history[0]["version_no"] == 2  # latest first


async def test_vendor_upload_and_total(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    vendor = csv_upload("vendor.csv", "Vendor Name,Service Name,Rate,Total Cost,Remark\nABC Catering,Staff,500,15000,staff team\nXYZ Decor,Decor,2000,8000,decor setup\n")
    resp = await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=vendor", headers=auth(token), files=vendor)
    assert resp.status_code == 200, resp.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    assert len(detail["vendors"]) == 2
    assert detail["total_vendor_cost"] == 23000

    vendor_id = detail["vendors"][0]["id"]
    ok = await client.post(f"/api/events/{inquiry_id}/vendors", headers=auth(token), json={
        "rows": [{"id": vendor_id, "rate": 600, "total_cost": None, "remark": "rate increased"}]
    })
    assert ok.status_code == 200, ok.text
    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    assert detail["vendors"][0]["rate"] == 600


async def test_kitchen_inventory_upload(client):
    token = await login(client, "kitchen@shaguncatering.com", "kitchen123")
    admin_token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, admin_token)

    kit = csv_upload("kitchen.csv", "Item Name,Prepared Qty,Unit,Used Qty,Remaining Qty,Remark\nPaneer Tikka,50,kg,30,20,ready\nDal Makhani,80,kg,50,30,ready\n")
    resp = await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=kitchen_inventory", headers=auth(token), files=kit)
    assert resp.status_code == 200, resp.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(admin_token))).json()
    assert len(detail["kitchen_inventory"]) == 2
    assert detail["kitchen_inventory"][0]["prepared_qty"] == 50


async def test_complete_event_locks_edits(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    ingredient = csv_upload("ingredient.csv", "Item Name,Qty,Unit\nPaneer,10,kg\n")
    await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=ingredient", headers=auth(token), files=ingredient)

    complete = await client.post(f"/api/events/{inquiry_id}/complete", headers=auth(token))
    assert complete.status_code == 200, complete.text

    detail = (await client.get(f"/api/events/{inquiry_id}", headers=auth(token))).json()
    assert detail["is_completed"] is True
    assert detail["completed_at"] is not None

    # double-complete rejected
    again = await client.post(f"/api/events/{inquiry_id}/complete", headers=auth(token))
    assert again.status_code == 400

    # edits rejected after completion
    edit = await client.post(f"/api/events/{inquiry_id}/inventory-items", headers=auth(token), json={
        "rows": [{"item_name": "Paneer", "received_qty": 8, "transfer_count": None, "returned_qty": None, "remark": "x"}]
    })
    assert edit.status_code == 400

    # uploads rejected after completion
    up = await client.post(f"/api/inquiries/{inquiry_id}/inventory-upload?movement_type=received", headers=auth(token), files=csv_upload("received.csv", "Paneer,5,kg\n"))
    assert up.status_code == 400


async def test_full_excel_preview_no_cap(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    inquiry_id = await create_handover_inquiry(client, token)

    rows = "\n".join(f"item{i},{i}kg" for i in range(250))
    up = await client.post(f"/api/inquiries/{inquiry_id}/upload?file_type=inventory", headers=auth(token), files=csv_upload("big.csv", "Item,Qty\n" + rows + "\n"))
    assert up.status_code == 200, up.text

    preview = await client.get(f"/api/inquiries/{inquiry_id}/file/inventory/preview", headers=auth(token))
    assert preview.status_code == 200
    assert len(preview.json()["rows"]) == 251  # header + 250
