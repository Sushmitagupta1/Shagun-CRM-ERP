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
        "username": "admin@shaguncatering.com",
        "password": "admin123",
    })
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    return resp.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_get_company_settings_requires_auth(client):
    resp = await client.get("/api/settings/company")
    assert resp.status_code in (401, 403)


async def test_get_company_settings(client):
    token = await login(client)
    resp = await client.get("/api/settings/company", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Shagun Caterers"
    assert data["email"] == "catering@cafeuppercrust.com"
    assert data["phone"] == "+91 8980003121"
    assert data["gst"] == "24AEOFS0061F1Z7"
    assert "Parshwanath Business Park" in data["address"]


async def test_update_company_settings(client):
    token = await login(client)
    resp = await client.put("/api/settings/company", headers=auth(token), json={
        "name": "Shagun Caterers",
        "gst": "24AEOFS0061F1Z7",
        "phone": "+91 9000000000",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["phone"] == "+91 9000000000"
    assert data["gst"] == "24AEOFS0061F1Z7"
    assert data["name"] == "Shagun Caterers"

    token = await login(client)
    resp = await client.put("/api/settings/company", headers=auth(token), json={
        "phone": "+91 8980003121",
    })
    assert resp.status_code == 200
    assert resp.json()["phone"] == "+91 8980003121"


async def test_get_logo_when_none_uploaded(client):
    token = await login(client)
    resp = await client.get("/api/settings/company/logo")
    assert resp.status_code == 404
    assert token
