import json
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import current_user
from ..authz import load_space_context
from ..config import settings
from ..core import ApiError, dump, not_found
from ..db import get_db, now
from ..entitlements import consume, entitlements, refund
from ..models import CalendarEvent, Document, Note, Project, Task, User, VoroAction, VoroMessage
from ..registry import BY_KEY
from ..services import record_activity

router = APIRouter(prefix="/voro", tags=["voro"])

AGENTS = {
    "voro": {"name": "Voro", "role": "Connective intelligence", "system": "You are Voro, the intelligence layer of Notevoro. Be concise, calm and precise. Use the Space context provided; never invent data that is not in the context."},
    "atlas": {"name": "Prof Atlas", "role": "Tutor", "system": "You are Prof Atlas, a patient tutor. Explain step by step, check understanding, offer a quick practice question."},
    "nova": {"name": "Dr Nova", "role": "Researcher", "system": "You are Dr Nova, a rigorous researcher. Structure answers with evidence, open questions and next steps. Flag uncertainty."},
    "astra": {"name": "Astra", "role": "Task Assistant", "system": "You are Astra, an action-oriented assistant. Turn intent into concrete tasks, events and plans. Prefer proposing actions via tools."},
    "luna": {"name": "Luna", "role": "Explainer", "system": "You are Luna, a friendly explainer. Use plain language and analogies. Keep it short."},
}

TOOLS = [
    {"type": "function", "function": {"name": "create_task", "description": "Create a task in the current Space", "parameters": {"type": "object", "properties": {"title": {"type": "string"}, "priority": {"type": "string", "enum": ["low", "medium", "high"]}, "due_at": {"type": "string", "description": "ISO datetime"}}, "required": ["title"]}}},
    {"type": "function", "function": {"name": "create_note", "description": "Create a note in the current Space", "parameters": {"type": "object", "properties": {"title": {"type": "string"}, "content": {"type": "string"}}, "required": ["title", "content"]}}},
    {"type": "function", "function": {"name": "create_event", "description": "Create a calendar event or meeting", "parameters": {"type": "object", "properties": {"title": {"type": "string"}, "start_at": {"type": "string"}, "end_at": {"type": "string"}, "kind": {"type": "string", "enum": ["event", "meeting"]}, "meeting_provider": {"type": "string", "enum": ["zoom", "google_meet", "teams", "none"]}}, "required": ["title", "start_at"]}}},
    {"type": "function", "function": {"name": "create_project", "description": "Create a project", "parameters": {"type": "object", "properties": {"name": {"type": "string"}, "description": {"type": "string"}}, "required": ["name"]}}},
]


class AskIn(BaseModel):
    message: str = Field(min_length=1, max_length=6000)
    space_id: Optional[str] = None
    agent: str = "voro"
    capability: Optional[str] = None


async def build_context(db, user: User, space_id: Optional[str]) -> tuple[str, dict]:
    """Scoped, minimized, permission-checked context. Never mixes Spaces."""
    ent = await entitlements(db, user)
    if not space_id:
        return f"User: {user.name}. Plan: {ent['plan']}. No Space selected; this is the global Brain.", {"scope": "brain"}
    ctx = await load_space_context(space_id, user, db)
    s = ctx.space
    t = now()
    tasks = (await db.execute(select(Task).where(Task.space_id == s.id, Task.deleted_at.is_(None), Task.status != "done").order_by(Task.due_at.asc().nulls_last()).limit(15))).scalars().all()
    notes = (await db.execute(select(Note).where(Note.space_id == s.id, Note.deleted_at.is_(None)).order_by(Note.updated_at.desc()).limit(8))).scalars().all()
    docs = (await db.execute(select(Document).where(Document.space_id == s.id, Document.deleted_at.is_(None)).order_by(Document.updated_at.desc()).limit(5))).scalars().all()
    projects = (await db.execute(select(Project).where(Project.space_id == s.id, Project.deleted_at.is_(None)).limit(10))).scalars().all()
    events = (await db.execute(select(CalendarEvent).where(CalendarEvent.space_id == s.id, CalendarEvent.deleted_at.is_(None), CalendarEvent.end_at >= t, CalendarEvent.start_at <= t + timedelta(days=7)).order_by(CalendarEvent.start_at).limit(8))).scalars().all()
    lines = [f"User: {user.name} (role: {ctx.role}). Plan: {ent['plan']}. Now: {t.isoformat()}.",
             f"Space: {s.name} ({s.type}). {s.description or ''}", f"Enabled capabilities: {', '.join(BY_KEY[k]['name'] for k in s.enabled_capabilities if k in BY_KEY)}",
             "Open tasks: " + ("; ".join(f"[{x.priority}] {x.title}" + (f" due {x.due_at.date()}" if x.due_at else "") for x in tasks) or "none"),
             "Projects: " + ("; ".join(f"{p.name} ({p.status})" for p in projects) or "none"),
             "Upcoming: " + ("; ".join(f"{e.title} at {e.start_at.strftime('%a %H:%M')}" for e in events) or "none"),
             "Recent notes: " + ("; ".join(f"{n.title}: {(n.content or '')[:160]}" for n in notes) or "none"),
             "Recent documents: " + ("; ".join(f"{d.title}: {(d.content or '')[:200]}" for d in docs) or "none")]
    return "\n".join(lines), {"scope": "space", "space": {"id": s.id, "name": s.name, "type": s.type, "icon": s.icon, "accent": s.accent},
                              "counts": {"tasks": len(tasks), "projects": len(projects), "notes": len(notes), "documents": len(docs), "events": len(events)}}


@router.get("/agents")
async def agents():
    return [{"key": k, **{x: v[x] for x in ("name", "role")}} for k, v in AGENTS.items()]


@router.get("/history")
async def history(user: User = Depends(current_user), db: AsyncSession = Depends(get_db), space_id: Optional[str] = None, limit: int = 40):
    stmt = select(VoroMessage).where(VoroMessage.user_id == user.id)
    stmt = stmt.where(VoroMessage.space_id == space_id) if space_id else stmt.where(VoroMessage.space_id.is_(None))
    rows = (await db.execute(stmt.order_by(VoroMessage.created_at.desc()).limit(limit))).scalars().all()
    return [dump(m) for m in reversed(rows)]


@router.get("/context")
async def context(user: User = Depends(current_user), db: AsyncSession = Depends(get_db), space_id: Optional[str] = None):
    _, meta = await build_context(db, user, space_id)
    return meta


@router.post("/ask")
async def ask(body: AskIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    agent = AGENTS.get(body.agent) or AGENTS["voro"]
    ent = await entitlements(db, user)
    if body.agent in ("nova", "astra") and not ent["features"]["advanced_agents"] and ent["plan"] == "free":
        pass  # basic access to agents on free; advanced_agents gates depth via model budget below
    context_text, meta = await build_context(db, user, body.space_id)
    if not settings.openai_api_key:
        from ..ai import ai_available, ai_provider, emergent_reply
        if not ai_available():
            raise ApiError(503, "AI_NOT_CONFIGURED", "Voro's model provider is not configured. Add an OpenAI key, or the Emergent universal key.", {"provider": "none", "model": settings.openai_model})
        # Emergent universal key path (text reply, tools proposed by native provider only)
        await consume(db, user, "ai_requests", 1, body.space_id, source="voro.ask")
        db.add(VoroMessage(user_id=user.id, space_id=body.space_id, role="user", content=body.message, agent=body.agent))
        await db.commit()
        prior = (await db.execute(select(VoroMessage).where(VoroMessage.user_id == user.id, VoroMessage.space_id == body.space_id).order_by(VoroMessage.created_at.desc()).limit(12))).scalars().all()
        transcript = [(m.role, m.content) for m in reversed(prior)][:-1]
        system = agent["system"] + "\n\nCONTEXT (authoritative, scoped to what this user may see):\n" + context_text
        try:
            text = await emergent_reply(f"voro-{user.id}-{body.space_id or 'brain'}", system, transcript, body.message)
        except Exception as exc:  # noqa: BLE001
            await refund(db, user, "ai_requests", 1)
            await db.commit()
            raise ApiError(502, "AI_PROVIDER_ERROR", "Voro could not reach its model provider. Please retry.", {"reason": str(exc)[:200], "provider": ai_provider()})
        reply = VoroMessage(user_id=user.id, space_id=body.space_id, role="assistant", content=text, agent=body.agent, actions=[])
        db.add(reply)
        await db.commit()
        return {"message": dump(reply), "actions": [], "context": meta, "usage": (await entitlements(db, user))["usage"]}
    await consume(db, user, "ai_requests", 1, body.space_id, source="voro.ask")
    db.add(VoroMessage(user_id=user.id, space_id=body.space_id, role="user", content=body.message, agent=body.agent))
    await db.commit()
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        prior = (await db.execute(select(VoroMessage).where(VoroMessage.user_id == user.id, VoroMessage.space_id == body.space_id).order_by(VoroMessage.created_at.desc()).limit(12))).scalars().all()
        messages = [{"role": "system", "content": agent["system"] + "\n\nCONTEXT (authoritative, scoped to what this user may see):\n" + context_text +
                     "\n\nWhen the user asks to create something, call a tool. Tools only propose actions; the user confirms them in the UI."}]
        for m in reversed(prior):
            messages.append({"role": "user" if m.role == "user" else "assistant", "content": m.content})
        resp = await client.chat.completions.create(model=settings.openai_model, messages=messages, tools=TOOLS if body.space_id else None, max_tokens=900 if ent["plan"] != "free" else 500, temperature=0.4)
    except ApiError:
        raise
    except Exception as exc:
        await refund(db, user, "ai_requests", 1)
        await db.commit()
        raise ApiError(502, "AI_PROVIDER_ERROR", "Voro could not reach its model provider. Please retry.", {"reason": str(exc)[:200]})
    choice = resp.choices[0].message
    actions = []
    for call in choice.tool_calls or []:
        try:
            args = json.loads(call.function.arguments or "{}")
        except ValueError:
            args = {}
        act = VoroAction(user_id=user.id, space_id=body.space_id, action_type=call.function.name, context=args, confirmation_required=True, status="pending")
        db.add(act)
        await db.flush()
        actions.append(dump(act))
    text = choice.content or ("I've prepared the following actions for your confirmation." if actions else "")
    reply = VoroMessage(user_id=user.id, space_id=body.space_id, role="assistant", content=text, agent=body.agent, actions=[a["id"] for a in actions])
    db.add(reply)
    usage = resp.usage
    if usage:
        from ..models import UsageRecord
        db.add(UsageRecord(user_id=user.id, space_id=body.space_id, resource_type="ai_tokens", amount=usage.total_tokens, unit="tokens", period=now().strftime("%Y-%m"), source="voro.ask",
                           meta={"model": settings.openai_model, "input": usage.prompt_tokens, "output": usage.completion_tokens, "agent": body.agent}))
    await db.commit()
    return {"message": dump(reply), "actions": actions, "context": meta, "usage": (await entitlements(db, user))["usage"]}


@router.post("/actions/{action_id}/confirm")
async def confirm_action(action_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    act = (await db.execute(select(VoroAction).where(VoroAction.id == action_id, VoroAction.user_id == user.id))).scalar_one_or_none()
    if not act:
        raise not_found("Action")
    if act.status != "pending":
        return dump(act)
    ctx = await load_space_context(act.space_id, user, db)
    ctx.require("member")
    await consume(db, user, "voro_actions", 1, act.space_id, source="voro.action", idempotency_key=f"voro-action-{act.id}")
    a = act.context or {}
    try:
        if act.action_type == "create_task":
            ctx.require_capability("tasks")
            obj = Task(space_id=ctx.space.id, created_by=user.id, title=a.get("title", "Task"), priority=a.get("priority", "medium"), due_at=_dt(a.get("due_at")), source={"voro_action": act.id})
        elif act.action_type == "create_note":
            ctx.require_capability("notes")
            obj = Note(space_id=ctx.space.id, created_by=user.id, title=a.get("title", "Note"), content=a.get("content", ""))
        elif act.action_type == "create_project":
            ctx.require_capability("projects")
            obj = Project(space_id=ctx.space.id, created_by=user.id, name=a.get("name", "Project"), description=a.get("description"))
        elif act.action_type == "create_event":
            ctx.require_capability("calendar")
            start = _dt(a.get("start_at")) or now()
            prov = a.get("meeting_provider") if a.get("meeting_provider") != "none" else None
            obj = CalendarEvent(space_id=ctx.space.id, created_by=user.id, title=a.get("title", "Event"), start_at=start, end_at=_dt(a.get("end_at")) or start + timedelta(hours=1), kind=a.get("kind", "event"), meeting_provider=prov)
        else:
            raise ApiError(400, "UNKNOWN_ACTION", "Unknown action type")
        db.add(obj)
        await db.flush()
        act.status, act.result = "completed", {"entity": obj.__tablename__, "id": obj.id}
        await record_activity(db, ctx.space.id, user, f"voro.{act.action_type}", obj.__tablename__, obj.id, f"Voro created {getattr(obj, 'title', None) or getattr(obj, 'name', '')} for {user.name}")
        await db.commit()
    except ApiError as exc:
        act.status, act.error = "failed", str(exc.detail)
        await refund(db, user, "voro_actions", 1)
        await db.commit()
        raise
    return dump(act)


@router.post("/actions/{action_id}/reject")
async def reject_action(action_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    act = (await db.execute(select(VoroAction).where(VoroAction.id == action_id, VoroAction.user_id == user.id))).scalar_one_or_none()
    if not act:
        raise not_found("Action")
    act.status = "rejected"
    await db.commit()
    return dump(act)


def _dt(v):
    if not v:
        return None
    from datetime import datetime
    try:
        d = datetime.fromisoformat(v.replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=now().tzinfo)
    except ValueError:
        return None
