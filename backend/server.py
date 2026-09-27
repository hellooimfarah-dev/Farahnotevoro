import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app import models  # noqa: E402,F401
from app.config import settings  # noqa: E402
from app.core import RequestContextMiddleware, http_exception_handler, validation_exception_handler  # noqa: E402
from app.db import Base  # noqa: E402
from app.realtime import hub  # noqa: E402
from app.routers import account, auth, chat, collab, inbox, items, pages, spaces, studio, voro  # noqa: E402
from app.storage import storage  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database engine is initialized before using it
    from app.db import ensure_engine_initialized
    await ensure_engine_initialized()
    
    # Import engine after initialization to get the actual engine object
    from app.db import engine as initialized_engine
    
    async with initialized_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # ---- idempotent additive migrations (Aurora-compatible) --------
        # In production we'd use Alembic; for now the app performs safe
        # `ADD COLUMN IF NOT EXISTS` on the visibility/ACL columns so a
        # cold start on an existing database picks them up without a
        # manual step.
        from sqlalchemy import text as _text
        for _tbl in ("notes", "documents", "projects", "tasks", "events", "files", "records", "pages"):
            try:
                await conn.execute(_text(f"ALTER TABLE {_tbl} ADD COLUMN IF NOT EXISTS visibility VARCHAR(16) NOT NULL DEFAULT 'team'"))
                await conn.execute(_text(f"ALTER TABLE {_tbl} ADD COLUMN IF NOT EXISTS shared_with JSONB NOT NULL DEFAULT '[]'::jsonb"))
                await conn.execute(_text(f"CREATE INDEX IF NOT EXISTS ix_{_tbl}_visibility ON {_tbl} (visibility)"))
            except Exception as _e:  # noqa: BLE001
                # Table may not exist yet in this repo; log & continue.
                logging.getLogger("notevoro.migrate").warning("skip %s: %s", _tbl, _e)
        # Additive: Space.cover_image (customizable landscape cover)
        for _stmt in (
            "ALTER TABLE spaces ADD COLUMN IF NOT EXISTS cover_image TEXT",
            "ALTER TABLE spaces ADD COLUMN cover_image TEXT",  # SQLite fallback (no IF NOT EXISTS)
        ):
            try:
                await conn.execute(_text(_stmt))
                break
            except Exception:  # noqa: BLE001
                continue
        # In Personal Spaces every new object created going forward defaults
        # to `private` (see items router), but existing rows must be back-
        # filled so history doesn't accidentally become team-visible.
        try:
            await conn.execute(_text(
                "UPDATE notes n SET visibility='private' "
                "FROM spaces s WHERE n.space_id=s.id AND s.type='personal' AND n.visibility='team'"
            ))
            await conn.execute(_text(
                "UPDATE documents d SET visibility='private' "
                "FROM spaces s WHERE d.space_id=s.id AND s.type='personal' AND d.visibility='team'"
            ))
            await conn.execute(_text(
                "UPDATE tasks t SET visibility='private' "
                "FROM spaces s WHERE t.space_id=s.id AND s.type='personal' AND t.visibility='team'"
            ))
            await conn.execute(_text(
                "UPDATE projects p SET visibility='private' "
                "FROM spaces s WHERE p.space_id=s.id AND s.type='personal' AND p.visibility='team'"
            ))
        except Exception as _e:  # noqa: BLE001
            logging.getLogger("notevoro.migrate").warning("backfill personal visibility skipped: %s", _e)
    yield
    # Dispose the initialized engine
    from app.db import engine as initialized_engine
    await initialized_engine.dispose()


app = FastAPI(title="Notevoro API", version="1.0.0", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(RequestContextMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in settings.cors_origins.split(",")], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

for r in (auth.router, spaces.router, items.router, pages.router, chat.router, voro.router, studio.router, account.router, collab.router, inbox.router):
    app.include_router(r, prefix="/api/v1")


@app.get("/api/health/live")
async def live():
    return {"status": "ok"}


@app.get("/api/health/ready")
async def ready():
    checks = {"database": "ok", "storage": storage.name, "auth_provider": __import__("app.auth", fromlist=["provider"]).provider.name,
              "ai": "configured" if settings.openai_api_key else "not_configured", "realtime": "configured" if settings.supabase_configured else "not_configured", "realtime_connections": len(hub.online_users())}
    try:
        from app.db import engine as initialized_engine
        async with initialized_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        checks["database"] = f"error: {exc.__class__.__name__}"
        return {"status": "degraded", "checks": checks}
    return {"status": "ready", "checks": checks}
