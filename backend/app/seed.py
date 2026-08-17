import asyncio
import uuid
from app.database import async_session_factory, engine, Base
from app.models.user import Role, User, RoleName
from app.services.auth_service import hash_password

ROLES = [
    {"name": RoleName.ADMIN, "permissions": {"all": True}},
    {"name": RoleName.SALES_HEAD, "permissions": {"inquiries": ["read", "write", "update"], "dashboard": ["sales"]}},
    {"name": RoleName.MENU_PLANNER, "permissions": {"menus": ["read", "write"], "inquiries": ["read"]}},
    {"name": RoleName.PRESENTATION_EXEC, "permissions": {"presentations": ["read", "write"], "inquiries": ["read"]}},
    {"name": RoleName.OPERATIONS_MANAGER, "permissions": {"events": ["read", "write"], "vendors": ["read", "write"], "warehouse": ["read", "write"]}},
    {"name": RoleName.KITCHEN, "permissions": {"kitchen": ["read", "write"], "inquiries": ["read"]}},
    {"name": RoleName.WAREHOUSE, "permissions": {"inventory": ["read", "write"], "warehouse": ["read", "write"]}},
    {"name": RoleName.FINANCE, "permissions": {"settlements": ["read", "write", "export"], "finance": ["read"]}},
]

DEFAULT_ADMIN = {
    "email": "admin@shaguncatering.com",
    "password": "AdityaD#2026",
    "full_name": "Aditya Dsouza",
}

TEST_USERS = [
    {"email": "vinod@shaguncatering.com", "password": "Makachiki@1991", "full_name": "Vinod Kalal", "role": RoleName.SALES_HEAD},
    {"email": "vishal@shaguncatering.com", "password": "VISHAL##439", "full_name": "Vishal Raval", "role": RoleName.MENU_PLANNER},
    {"email": "shayank@shaguncatering.com", "password": "shayank@uc1819", "full_name": "Shayank Sharma", "role": RoleName.PRESENTATION_EXEC},
    {"email": "lalit@shaguncatering.com", "password": "LalitK@2026", "full_name": "Lalit Kalal", "role": RoleName.OPERATIONS_MANAGER},
    {"email": "harshvardhan@shaguncatering.com", "password": "HarshvardhanS@2026", "full_name": "Harshvardhan Singh", "role": RoleName.KITCHEN},
    {"email": "ranjay@shaguncatering.com", "password": "RanjayS@2026", "full_name": "Ranjay Saroj", "role": RoleName.WAREHOUSE},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        from sqlalchemy import select
        result = await session.execute(select(Role).limit(1))
        if result.scalar_one_or_none() is not None:
            print("Database already seeded. Skipping.")
            return

        role_map = {}
        for role_data in ROLES:
            role = Role(id=uuid.uuid4(), name=role_data["name"], permissions=role_data["permissions"])
            session.add(role)
            role_map[role_data["name"]] = role

        await session.flush()

        admin_role = role_map[RoleName.ADMIN]
        admin = User(
            id=uuid.uuid4(),
            email=DEFAULT_ADMIN["email"],
            password_hash=hash_password(DEFAULT_ADMIN["password"]),
            full_name=DEFAULT_ADMIN["full_name"],
            role_id=admin_role.id,
            is_active=True,
        )
        session.add(admin)

        for test_user in TEST_USERS:
            role = role_map[test_user["role"]]
            user = User(
                id=uuid.uuid4(),
                email=test_user["email"],
                password_hash=hash_password(test_user["password"]),
                full_name=test_user["full_name"],
                role_id=role.id,
                is_active=True,
            )
            session.add(user)

        await session.commit()
        print("Seed complete!")
        print()
        print("  LOGIN CREDENTIALS:")
        print(f"  {'Email':<32} {'Password':<15} {'Role'}")
        print(f"  {'-'*32} {'-'*15} {'-'*25}")
        print(f"  {DEFAULT_ADMIN['email']:<32} {DEFAULT_ADMIN['password']:<15} admin")
        for u in TEST_USERS:
            print(f"  {u['email']:<32} {u['password']:<15} {u['role'].value}")


if __name__ == "__main__":
    asyncio.run(seed())
