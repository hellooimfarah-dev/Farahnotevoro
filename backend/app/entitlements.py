"""ONE entitlement engine + ONE usage engine. Backend is the only source of truth."""
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from .core import ApiError
from .db import now
from .models import Subscription, UsageCounter, UsageRecord, User

PLANS = {
    "free": {"label": "Free", "price": 0, "ai_requests": 30, "voro_actions": 20, "transcription_minutes": 0, "cloud_storage_mb": 200,
             "team_spaces": 0, "members_per_team": 1, "collaboration": False, "integrations": False, "automation": False, "advanced_agents": False},
    "pro": {"label": "Pro", "price": 12, "ai_requests": 1000, "voro_actions": 500, "transcription_minutes": 300, "cloud_storage_mb": 20480,
            "team_spaces": 5, "members_per_team": 15, "collaboration": True, "integrations": True, "automation": True, "advanced_agents": False},
    "premium": {"label": "Premium", "price": 20, "ai_requests": 4000, "voro_actions": 2000, "transcription_minutes": 1200, "cloud_storage_mb": 102400,
                "team_spaces": 25, "members_per_team": 50, "collaboration": True, "integrations": True, "automation": True, "advanced_agents": True},
    "enterprise": {"label": "Enterprise", "price": None, "ai_requests": 20000, "voro_actions": 10000, "transcription_minutes": 6000, "cloud_storage_mb": 1048576,
                   "team_spaces": 1000, "members_per_team": 5000, "collaboration": True, "integrations": True, "automation": True, "advanced_agents": True},
}
UNITS = {"ai_requests": "requests", "voro_actions": "actions", "transcription_minutes": "minutes", "cloud_storage_mb": "MB"}


def period_key(dt: Optional[datetime] = None) -> str:
    return (dt or now()).strftime("%Y-%m")


def period_reset(dt: Optional[datetime] = None) -> str:
    d = (dt or now()).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    m = d.month % 12 + 1
    return d.replace(year=d.year + (1 if m == 1 else 0), month=m).isoformat()


async def get_subscription(db: AsyncSession, user_id: str) -> Subscription:
    sub = (await db.execute(select(Subscription).where(Subscription.user_id == user_id))).scalar_one_or_none()
    if not sub:
        sub = Subscription(user_id=user_id, plan="free", status="active", started_at=now())
        db.add(sub)
        await db.flush()
    return sub


def _aware(dt):
    """Ensure a datetime is tz-aware (UTC) — SQLite loses tz info on write,
    which can cause `t > sub.expires_at` to raise TypeError. In production
    (Aurora Postgres) tz is preserved; this shim just makes local dev work."""
    if dt is None:
        return None
    if getattr(dt, "tzinfo", None) is None:
        from datetime import timezone as _tz
        return dt.replace(tzinfo=_tz.utc)
    return dt


def effective_state(sub: Subscription):
    """ACTIVE -> EXPIRING -> GRACE -> RESTRICTED lifecycle, computed server-side."""
    t = now()
    expires_at = _aware(sub.expires_at)
    grace_until = _aware(sub.grace_until)
    if sub.plan == "free":
        return "active", "free"
    if sub.status == "canceled" or (expires_at and t > expires_at):
        if grace_until and t <= grace_until:
            return "grace", sub.plan
        return "restricted", "free"
    if expires_at and t > expires_at - timedelta(days=7):
        return "expiring", sub.plan
    return "active", sub.plan


async def entitlements(db: AsyncSession, user: User) -> dict:
    sub = await get_subscription(db, user.id)
    state, plan = effective_state(sub)
    limits = PLANS[plan]
    period = period_key()
    counters = (await db.execute(select(UsageCounter).where(UsageCounter.user_id == user.id, UsageCounter.period == period))).scalars().all()
    usage = {c.resource_type: c.amount for c in counters}
    return {
        "plan": plan, "subscribed_plan": sub.plan, "state": state, "status": sub.status,
        "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
        "grace_until": sub.grace_until.isoformat() if sub.grace_until else None,
        "limits": limits, "usage": {k: usage.get(k, 0) for k in UNITS}, "period": period, "resets_at": period_reset(),
        "features": {k: limits[k] for k in ("collaboration", "integrations", "automation", "advanced_agents")},
    }


async def require_feature(db: AsyncSession, user: User, feature: str):
    ent = await entitlements(db, user)
    if not ent["features"].get(feature):
        raise ApiError(402, "PLAN_REQUIRED", f"'{feature}' requires the Pro plan or higher.",
                       {"feature": feature, "plan": ent["plan"], "upgrade": "/settings/billing"})
    return ent


async def consume(db: AsyncSession, user: User, resource: str, amount: int = 1, space_id: Optional[str] = None,
                  source: str = "api", idempotency_key: Optional[str] = None, meta: Optional[dict] = None):
    """Atomic check-and-increment: UPDATE ... WHERE amount + :n <= :limit. Race-safe across concurrent requests."""
    ent = await entitlements(db, user)
    limit = ent["limits"][resource]
    period = period_key()
    if idempotency_key:
        dup = (await db.execute(select(UsageRecord.id).where(UsageRecord.idempotency_key == idempotency_key))).scalar_one_or_none()
        if dup:
            return ent
    await db.execute(text("INSERT INTO usage_counters (id, user_id, resource_type, period, amount) VALUES (gen_random_uuid()::text, :u, :r, :p, 0) ON CONFLICT (user_id, resource_type, period) DO NOTHING"),
                     {"u": user.id, "r": resource, "p": period}) if db.bind.dialect.name == "postgresql" else None
    counter = (await db.execute(select(UsageCounter).where(UsageCounter.user_id == user.id, UsageCounter.resource_type == resource, UsageCounter.period == period))).scalar_one_or_none()
    if counter is None:
        counter = UsageCounter(user_id=user.id, resource_type=resource, period=period, amount=0)
        db.add(counter)
        await db.flush()
    if isinstance(limit, (int, float)) and limit >= 0 and counter.amount + amount > limit:
        current = counter.amount
        await db.rollback()
        raise ApiError(429, "LIMIT_REACHED", f"You have reached your {resource.replace('_', ' ')} limit for this period.",
                       {"resource": resource, "current": current, "limit": limit, "unit": UNITS[resource], "resets_at": period_reset(),
                        "plan": ent["plan"], "upgrade": "/settings/billing" if ent["plan"] != "enterprise" else None})
    counter.amount += amount
    db.add(UsageRecord(user_id=user.id, space_id=space_id, resource_type=resource, amount=amount, unit=UNITS[resource], period=period, source=source, idempotency_key=idempotency_key, meta=meta or {}))
    return ent


async def refund(db: AsyncSession, user: User, resource: str, amount: int = 1):
    """Failed operations must not consume usage."""
    counter = (await db.execute(select(UsageCounter).where(UsageCounter.user_id == user.id, UsageCounter.resource_type == resource, UsageCounter.period == period_key()))).scalar_one_or_none()
    if counter:
        counter.amount = max(counter.amount - amount, 0)
