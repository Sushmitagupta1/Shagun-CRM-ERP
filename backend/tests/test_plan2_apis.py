import uuid
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def login(client: AsyncClient) -> str:
    resp = await client.post("/api/auth/login", json={
        "email": "admin@shaguncatering.com",
        "password": "admin123",
    })
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    return resp.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_health(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_list_users(client):
    token = await login(client)
    resp = await client.get("/api/users", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1


async def test_create_user(client):
    token = await login(client)
    resp = await client.post("/api/users", headers=auth(token), json={
        "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
        "password": "testpass123",
        "full_name": "Test User",
        "role_id": str(uuid.uuid4()),
    })
    assert resp.status_code in (201, 400)


async def test_create_and_list_inquiry(client):
    token = await login(client)
    create_resp = await client.post("/api/inquiries", headers=auth(token), json={
        "client_name": "Rajesh Kumar",
        "client_phone": "9876543210",
        "event_type": "Wedding",
        "pax": 500,
        "budget": 750000,
    })
    assert create_resp.status_code == 201
    data = create_resp.json()
    assert data["client_name"] == "Rajesh Kumar"
    assert data["status"] == "new"
    assert data["payment_status"] == "unpaid"

    list_resp = await client.get("/api/inquiries", headers=auth(token))
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1


async def test_update_inquiry_status(client):
    token = await login(client)
    create_resp = await client.post("/api/inquiries", headers=auth(token), json={
        "client_name": "Status Test",
        "client_phone": "9876543211",
        "event_type": "Birthday",
    })
    inquiry_id = create_resp.json()["id"]
    resp = await client.patch(f"/api/inquiries/{inquiry_id}/status", headers=auth(token), params={"new_status": "follow_up"})
    assert resp.status_code == 200
    get_resp = await client.get(f"/api/inquiries/{inquiry_id}", headers=auth(token))
    assert get_resp.json()["status"] == "follow_up"


async def test_invalid_status_transition(client):
    token = await login(client)
    create_resp = await client.post("/api/inquiries", headers=auth(token), json={
        "client_name": "Invalid Transition",
        "client_phone": "9876543212",
        "event_type": "Corporate",
    })
    inquiry_id = create_resp.json()["id"]
    resp = await client.patch(f"/api/inquiries/{inquiry_id}/status", headers=auth(token), params={"new_status": "confirmed"})
    assert resp.status_code == 400


async def test_settlement_requires_confirmed_inquiry(client):
    token = await login(client)
    create_resp = await client.post("/api/inquiries", headers=auth(token), json={
        "client_name": "Settlement Test",
        "client_phone": "9876543213",
        "event_type": "Wedding",
    })
    inquiry_id = create_resp.json()["id"]
    resp = await client.post("/api/settlements", headers=auth(token), json={
        "inquiry_id": inquiry_id,
        "revenue": 500000,
        "vendor_cost": 200000,
        "other_expenses": 50000,
    })
    assert resp.status_code == 400


async def test_settlement_list(client):
    token = await login(client)
    resp = await client.get("/api/settlements", headers=auth(token))
    assert resp.status_code == 200


async def test_admin_dashboard(client):
    token = await login(client)
    resp = await client.get("/api/dashboard/admin", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "total_inquiries" in data


async def test_sales_dashboard(client):
    token = await login(client)
    resp = await client.get("/api/dashboard/sales", headers=auth(token))
    assert resp.status_code == 200
    assert "new_inquiries" in resp.json()


async def test_finance_dashboard(client):
    token = await login(client)
    resp = await client.get("/api/dashboard/finance", headers=auth(token))
    assert resp.status_code == 200


async def test_monthly_trend_chart(client):
    token = await login(client)
    resp = await client.get("/api/dashboard/charts/monthly-trend", headers=auth(token))
    assert resp.status_code == 200


async def test_notifications(client):
    token = await login(client)
    resp = await client.get("/api/notifications", headers=auth(token))
    assert resp.status_code == 200
    assert "items" in resp.json()

    mark_resp = await client.patch("/api/notifications/read-all", headers=auth(token))
    assert mark_resp.status_code == 200
