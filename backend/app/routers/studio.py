"""Agents & Workflows: real persistence + execution (space-scoped)."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai import ai_available, ai_complete, ai_provider
from ..auth import current_user
from ..authz import load_space_context
from ..core import ApiError, dump, not_found
from ..db import get_db, now
from ..models import Agent, AgentRun, Task, User, Workflow, WorkflowRun
from ..services import record_activity

router = APIRouter(prefix="/spaces/{space_id}", tags=["studio"])


# ---------------- Agents ----------------
class AgentIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    instructions: Optional[str] = None
    config: Optional[dict] = None
    status: Optional[str] = None


class AgentCreate(BaseModel):
    description: str = Field(min_length=1, max_length=4000)
    name: Optional[str] = None


async def _agent(db, space_id, agent_id, user):
    ctx = await load_space_context(space_id, user, db)
    ctx.require("member")
    a = (await db.execute(select(Agent).where(Agent.id == agent_id, Agent.space_id == space_id, Agent.deleted_at.is_(None)))).scalar_one_or_none()
    if not a:
        raise not_found("Agent")
    return ctx, a


@router.get("/agents")
async def list_agents(space_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    ctx = await load_space_context(space_id, user, db)
    ctx.require("member")
    rows = (await db.execute(select(Agent).where(Agent.space_id == space_id, Agent.deleted_at.is_(None)).order_by(Agent.created_at.desc()))).scalars().all()
    return [dump(a) for a in rows]


@router.post("/agents", status_code=201)
async def create_agent(space_id: str, body: AgentCreate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    ctx = await load_space_context(space_id, user, db)
    ctx.require("member")
    name = body.name
    instructions = body.description
    # Use AI to draft a name + refined instructions when available
    if not name and ai_available():
        try:
            draft = await ai_complete(f"agent-draft-{user.id}",
                "You design AI agents. Given a user's description, reply with a short 2-4 word Title Case agent name on the first line, then a one-paragraph operating instruction. No preamble.",
                body.description)
            parts = [p.strip() for p in draft.split("\n", 1)]
            name = parts[0][:80] if parts else None
            if len(parts) > 1 and parts[1].strip():
                instructions = parts[1].strip()
        except Exception:
            pass
    a = Agent(space_id=space_id, created_by=user.id, name=(name or "New Agent")[:160], description=body.description,
              instructions=instructions,
              config={"model": "emergent/gpt-5.4", "temperature": 0.4, "knowledge": [], "tools": ["read_tasks", "read_pages"],
                      "permissions": {"read": True, "create": False, "modify": False, "external": False}, "schedule": None})
    db.add(a)
    await db.flush()
    await record_activity(db, space_id, user, "agent.created", "agent", a.id, f"{user.name} created agent {a.name}")
    await db.commit()
    return dump(a)


@router.patch("/agents/{agent_id}")
async def update_agent(space_id: str, agent_id: str, body: AgentIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    _, a = await _agent(db, space_id, agent_id, user)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(a, k, v)
    await db.commit()
    return dump(a)


@router.delete("/agents/{agent_id}", status_code=204)
async def delete_agent(space_id: str, agent_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    _, a = await _agent(db, space_id, agent_id, user)
    a.deleted_at = now()
    await db.commit()
    return None


class RunIn(BaseModel):
    input: Optional[str] = None


@router.get("/agents/{agent_id}/runs")
async def agent_runs(space_id: str, agent_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await _agent(db, space_id, agent_id, user)
    rows = (await db.execute(select(AgentRun).where(AgentRun.agent_id == agent_id).order_by(AgentRun.created_at.desc()).limit(30))).scalars().all()
    return [dump(r) for r in rows]


@router.post("/agents/{agent_id}/run")
async def run_agent(space_id: str, agent_id: str, body: RunIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    ctx, a = await _agent(db, space_id, agent_id, user)
    if not ai_available():
        raise ApiError(503, "AI_NOT_CONFIGURED", "No model provider configured. Add an OpenAI key or use the Emergent key.", {"provider": ai_provider()})
    # gather light context
    tasks = (await db.execute(select(Task).where(Task.space_id == space_id, Task.deleted_at.is_(None), Task.status != "done").order_by(Task.due_at.asc().nulls_last()).limit(20))).scalars().all()
    ctx_text = "Open tasks: " + ("; ".join(f"[{t.priority}] {t.title}" + (f" due {t.due_at.date()}" if t.due_at else "") for t in tasks) or "none")
    system = f"You are '{a.name}', an AI agent operating inside the Notevoro Space '{ctx.space.name}'.\nYour purpose: {a.description}\nInstructions: {a.instructions}\nUse only the provided context; be concise and actionable.\n\nCONTEXT:\n{ctx_text}"
    prompt = body.input or "Run your job now. Summarize findings and list concrete next steps."
    try:
        output = await ai_complete(f"agent-{a.id}", system, prompt)
    except Exception as exc:
        raise ApiError(502, "AI_PROVIDER_ERROR", "Agent could not reach its model provider.", {"reason": str(exc)[:200]})
    run = AgentRun(agent_id=a.id, space_id=space_id, user_id=user.id, input=prompt, output=output, status="completed", meta={"provider": ai_provider()})
    db.add(run)
    a.last_run_at = now()
    await record_activity(db, space_id, user, "agent.ran", "agent", a.id, f"{a.name} produced a report")
    await db.commit()
    return dump(run)


# ---------------- Workflows ----------------
class WorkflowIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    trigger: Optional[dict] = None
    nodes: Optional[list] = None
    enabled: Optional[bool] = None


async def _workflow(db, space_id, wf_id, user):
    ctx = await load_space_context(space_id, user, db)
    ctx.require("member")
    w = (await db.execute(select(Workflow).where(Workflow.id == wf_id, Workflow.space_id == space_id, Workflow.deleted_at.is_(None)))).scalar_one_or_none()
    if not w:
        raise not_found("Workflow")
    return ctx, w


@router.get("/workflows")
async def list_workflows(space_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    ctx = await load_space_context(space_id, user, db)
    ctx.require("member")
    rows = (await db.execute(select(Workflow).where(Workflow.space_id == space_id, Workflow.deleted_at.is_(None)).order_by(Workflow.created_at.desc()))).scalars().all()
    return [dump(w) for w in rows]


@router.post("/workflows", status_code=201)
async def create_workflow(space_id: str, body: WorkflowIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    ctx = await load_space_context(space_id, user, db)
    ctx.require("member")
    w = Workflow(space_id=space_id, created_by=user.id, name=(body.name or "New Workflow")[:160], description=body.description or "",
                 icon=body.icon or "workflow",
                 trigger=body.trigger or {"type": "task_completed", "label": "When a task is completed"},
                 nodes=body.nodes or [{"id": "n1", "type": "condition", "label": "Priority = High", "config": {}},
                                      {"id": "n2", "type": "action", "label": "Create follow-up task", "config": {"action": "create_task", "title": "Follow up"}}],
                 enabled=bool(body.enabled), stats={"runs": 0, "success": 0, "failed": 0})
    db.add(w)
    await db.flush()
    await record_activity(db, space_id, user, "workflow.created", "workflow", w.id, f"{user.name} created workflow {w.name}")
    await db.commit()
    return dump(w)


@router.patch("/workflows/{wf_id}")
async def update_workflow(space_id: str, wf_id: str, body: WorkflowIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    _, w = await _workflow(db, space_id, wf_id, user)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(w, k, v)
    await db.commit()
    return dump(w)


@router.delete("/workflows/{wf_id}", status_code=204)
async def delete_workflow(space_id: str, wf_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    _, w = await _workflow(db, space_id, wf_id, user)
    w.deleted_at = now()
    await db.commit()
    return None


@router.get("/workflows/{wf_id}/runs")
async def workflow_runs(space_id: str, wf_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await _workflow(db, space_id, wf_id, user)
    rows = (await db.execute(select(WorkflowRun).where(WorkflowRun.workflow_id == wf_id).order_by(WorkflowRun.created_at.desc()).limit(30))).scalars().all()
    return [dump(r) for r in rows]


@router.post("/workflows/{wf_id}/run")
async def run_workflow(space_id: str, wf_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    ctx, w = await _workflow(db, space_id, wf_id, user)
    logs = [{"node": "trigger", "label": w.trigger.get("label", "Trigger"), "status": "ok", "at": now().isoformat()}]
    ok = True
    for node in (w.nodes or []):
        ntype = node.get("type")
        cfg = node.get("config", {})
        try:
            if ntype == "action" and cfg.get("action") == "create_task":
                t = Task(space_id=space_id, created_by=user.id, title=cfg.get("title", "Workflow task"), priority=cfg.get("priority", "medium"), status="todo", source={"workflow": w.id})
                db.add(t)
                await db.flush()
                logs.append({"node": node.get("id"), "label": node.get("label"), "status": "ok", "detail": f"Created task '{t.title}'"})
            elif ntype == "ai":
                if ai_available():
                    out = await ai_complete(f"wf-{w.id}", "You are a workflow AI step. Be brief.", cfg.get("prompt", "Summarize the current state."))
                    logs.append({"node": node.get("id"), "label": node.get("label"), "status": "ok", "detail": out[:280]})
                else:
                    logs.append({"node": node.get("id"), "label": node.get("label"), "status": "skipped", "detail": "AI not configured"})
            else:
                logs.append({"node": node.get("id"), "label": node.get("label", ntype), "status": "ok"})
        except Exception as exc:  # noqa: BLE001
            ok = False
            logs.append({"node": node.get("id"), "label": node.get("label"), "status": "failed", "detail": str(exc)[:160]})
    stats = dict(w.stats or {})
    stats["runs"] = stats.get("runs", 0) + 1
    stats["success" if ok else "failed"] = stats.get("success" if ok else "failed", 0) + 1
    w.stats = stats
    w.last_run_at = now()
    run = WorkflowRun(workflow_id=w.id, space_id=space_id, user_id=user.id, status="success" if ok else "failed", logs=logs)
    db.add(run)
    await record_activity(db, space_id, user, "workflow.ran", "workflow", w.id, f"{w.name} ran ({'success' if ok else 'failed'})")
    await db.commit()
    return dump(run)
