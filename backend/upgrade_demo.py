import asyncio
from sqlalchemy import select
from app.db import SessionLocal
from app.models import User, Subscription
from app.db import now

async def main():
    async with SessionLocal() as db:
        u = (await db.execute(select(User).where(User.email == "demo@notevoro.com"))).scalar_one_or_none()
        if not u:
            print("no user"); return
        sub = (await db.execute(select(Subscription).where(Subscription.user_id == u.id))).scalar_one_or_none()
        if not sub:
            sub = Subscription(user_id=u.id, plan="pro", status="active", started_at=now())
            db.add(sub)
        else:
            sub.plan = "pro"
            sub.status = "active"
        await db.commit()
        print("upgraded", u.email, "->", sub.plan)

asyncio.run(main())
