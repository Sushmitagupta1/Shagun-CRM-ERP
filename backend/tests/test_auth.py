import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_health(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_login_success(client):
    response = await client.post("/api/auth/login", json={
        "email": "admin@shaguncatering.com",
        "password": "admin123",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client):
    response = await client.post("/api/auth/login", json={
        "email": "admin@shaguncatering.com",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


async def test_login_nonexistent_user(client):
    response = await client.post("/api/auth/login", json={
        "email": "nobody@example.com",
        "password": "test123",
    })
    assert response.status_code == 401


async def test_me_with_valid_token(client):
    login_resp = await client.post("/api/auth/login", json={
        "email": "admin@shaguncatering.com",
        "password": "admin123",
    })
    token = login_resp.json()["access_token"]
    me_resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    data = me_resp.json()
    assert data["email"] == "admin@shaguncatering.com"


async def test_me_without_token(client):
    response = await client.get("/api/auth/me")
    assert response.status_code == 403
