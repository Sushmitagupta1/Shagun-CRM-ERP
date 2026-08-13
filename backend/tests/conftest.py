import os
os.environ["ENVIRONMENT"] = "testing"
os.environ["UPLOAD_DIR"] = os.path.join(os.environ.get("TEMP", "/tmp"), "shagun_test_uploads")

import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest_asyncio.fixture(loop_scope="session")
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
