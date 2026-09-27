from datetime import datetime
from typing import Optional

from sqlalchemy import (JSON, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text,
                        UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base, IdMixin, TimestampMixin

J = JSON().with_variant(__import__("sqlalchemy.dialects.postgresql", fromlist=["JSONB"]).JSONB, "postgresql")


class User(Base, IdMixin, TimestampMixin):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text)
    identity_sub: Mapped[Optional[str]] = mapped_column(String(200), unique=True)
    password_hash: Mapped[Optional[str]] = mapped_column(Text)
    title: Mapped[Optional[str]] = mapped_column(String(200))
    bio: Mapped[Optional[str]] = mapped_column(Text)
    location: Mapped[Optional[str]] = mapped_column(String(200))
    timezone: Mapped[Optional[str]] = mapped_column(String(100))
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class Space(Base, IdMixin, TimestampMixin):
    __tablename__ = "spaces"
    __table_args__ = (
        CheckConstraint("type IN ('personal','team')", name="ck_space_type"),
        UniqueConstraint("owner_id", "name", name="uq_space_owner_name"),
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), default="sparkles")
    accent: Mapped[str] = mapped_column(String(30), default="violet")
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    enabled_capabilities: Mapped[list] = mapped_column(J, default=list)
    sidebar_order: Mapped[list] = mapped_column(J, default=list)
    settings: Mapped[dict] = mapped_column(J, default=dict)
    voro_context: Mapped[dict] = mapped_column(J, default=dict)
    cover_image: Mapped[Optional[str]] = mapped_column(Text)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class SpaceMember(Base, IdMixin, TimestampMixin):
    __tablename__ = "space_members"
    __table_args__ = (
        UniqueConstraint("space_id", "user_id", name="uq_member"),
        CheckConstraint("role IN ('owner','admin','member','viewer')", name="ck_role"),
    )
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="member")
    status: Mapped[str] = mapped_column(String(20), default="active")
    invited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    joined_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class Invitation(Base, IdMixin, TimestampMixin):
    __tablename__ = "invitations"
    __table_args__ = (UniqueConstraint("space_id", "email", name="uq_invite"),)
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="member")
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    invited_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)


class SpaceScoped:
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # --- Visibility / ACL (per Notevoro "My Work" model) -----------------
    # `visibility` = 'private' | 'specific' | 'team'
    #   private  -> only the creator can access
    #   specific -> only the creator + `shared_with` user_ids
    #   team     -> every active member of the Space (default for Team Spaces)
    # `shared_with` = optional array of {user_id, role} where role is 'viewer'|'editor'
    # In Personal Spaces the value is always 'private' — the concept exists so that
    # a personal object shared to a Team Space via "Promote" can carry ACL forward.
    visibility: Mapped[str] = mapped_column(String(16), default="team", nullable=False, index=True)
    shared_with: Mapped[list] = mapped_column(J, default=list, nullable=False)


class Note(Base, IdMixin, TimestampMixin, SpaceScoped):
    __tablename__ = "notes"
    title: Mapped[str] = mapped_column(String(300), default="Untitled")
    content: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list] = mapped_column(J, default=list)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    links: Mapped[list] = mapped_column(J, default=list)


class Document(Base, IdMixin, TimestampMixin, SpaceScoped):
    __tablename__ = "documents"
    title: Mapped[str] = mapped_column(String(300), default="Untitled document")
    content: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1)
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))


class DocumentVersion(Base, IdMixin, TimestampMixin):
    __tablename__ = "document_versions"
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)


class DocumentYjsUpdate(Base, IdMixin, TimestampMixin):
    """Append-only log of Yjs binary update chunks for a Document.
    Aurora remains the durable source of truth; this table lets a newly-connecting
    client bootstrap the CRDT state from a signed backend endpoint even when
    Supabase Realtime has garbage-collected the ephemeral broadcast."""
    __tablename__ = "document_yjs_updates"
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(64), nullable=False)
    update_b64: Mapped[str] = mapped_column(Text, nullable=False)  # base64-encoded Yjs update bytes
    author_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))



class Project(Base, IdMixin, TimestampMixin, SpaceScoped):
    __tablename__ = "projects"
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="active")
    color: Mapped[str] = mapped_column(String(30), default="violet")
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class Task(Base, IdMixin, TimestampMixin, SpaceScoped):
    __tablename__ = "tasks"
    __table_args__ = (CheckConstraint("status IN ('backlog','todo','in_progress','review','done')", name="ck_task_status"),
                      Index("ix_task_space_status", "space_id", "status"))
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="todo")
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    assignee_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    tags: Mapped[list] = mapped_column(J, default=list)
    position: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[Optional[dict]] = mapped_column(J)


class CalendarEvent(Base, IdMixin, TimestampMixin, SpaceScoped):
    __tablename__ = "calendar_events"
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    location: Mapped[Optional[str]] = mapped_column(String(300))
    kind: Mapped[str] = mapped_column(String(30), default="event")
    meeting_provider: Mapped[Optional[str]] = mapped_column(String(30))
    meeting_url: Mapped[Optional[str]] = mapped_column(Text)
    attendees: Mapped[list] = mapped_column(J, default=list)
    agenda: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    transcript: Mapped[Optional[str]] = mapped_column(Text)
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    color: Mapped[str] = mapped_column(String(30), default="violet")


class FileObject(Base, IdMixin, TimestampMixin, SpaceScoped):
    __tablename__ = "files"
    name: Mapped[str] = mapped_column(String(400), nullable=False)
    size: Mapped[int] = mapped_column(Integer, default=0)
    content_type: Mapped[str] = mapped_column(String(200), default="application/octet-stream")
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    folder: Mapped[Optional[str]] = mapped_column(String(300))
    tags: Mapped[list] = mapped_column(J, default=list)


class Record(Base, IdMixin, TimestampMixin, SpaceScoped):
    __tablename__ = "records"
    __table_args__ = (Index("ix_record_space_cap", "space_id", "capability_key"),)
    capability_key: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="active")
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    fields: Mapped[dict] = mapped_column(J, default=dict)
    position: Mapped[int] = mapped_column(Integer, default=0)


class Conversation(Base, IdMixin, TimestampMixin):
    __tablename__ = "conversations"
    __table_args__ = (CheckConstraint("type IN ('direct','group','space')", name="ck_conv_type"),)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    space_id: Mapped[Optional[str]] = mapped_column(ForeignKey("spaces.id", ondelete="CASCADE"), index=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(200))
    icon: Mapped[Optional[str]] = mapped_column(String(50))
    accent: Mapped[Optional[str]] = mapped_column(String(30))
    direct_key: Mapped[Optional[str]] = mapped_column(String(120), unique=True)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_message_preview: Mapped[Optional[str]] = mapped_column(String(300))


class ConversationMember(Base, IdMixin, TimestampMixin):
    __tablename__ = "conversation_members"
    __table_args__ = (UniqueConstraint("conversation_id", "user_id", name="uq_conv_member"),)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    last_read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)


class Message(Base, IdMixin, TimestampMixin):
    __tablename__ = "messages"
    __table_args__ = (UniqueConstraint("conversation_id", "client_id", name="uq_msg_client"),
                      Index("ix_msg_conv_created", "conversation_id", "created_at"))
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    client_id: Mapped[Optional[str]] = mapped_column(String(80))
    content: Mapped[str] = mapped_column(Text, default="")
    attachments: Mapped[list] = mapped_column(J, default=list)
    reply_to_id: Mapped[Optional[str]] = mapped_column(String(36))
    mentions: Mapped[list] = mapped_column(J, default=list)
    reactions: Mapped[dict] = mapped_column(J, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="sent")
    edited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class Notification(Base, IdMixin, TimestampMixin):
    __tablename__ = "notifications"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    space_id: Mapped[Optional[str]] = mapped_column(ForeignKey("spaces.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text)
    link: Mapped[Optional[str]] = mapped_column(Text)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class Page(Base, IdMixin, TimestampMixin, SpaceScoped):
    """Notion-styled nested page. First-class Notevoro object that can contain
    rich content (Tiptap JSON), reference other objects, and nest other Pages.

    Uses the SpaceScoped visibility/ACL model so a page created inside a Team
    Space with visibility='private' becomes the user's My-Work draft; when they
    are ready to share, they change visibility to 'specific' (+shared_with) or
    'team'. The exact same rules apply as for Notes/Documents/Tasks.
    """
    __tablename__ = "pages"
    __table_args__ = (Index("ix_pages_parent", "space_id", "parent_page_id"),)
    title: Mapped[str] = mapped_column(String(300), default="Untitled")
    icon: Mapped[Optional[str]] = mapped_column(String(80))     # emoji or lucide name
    cover: Mapped[Optional[str]] = mapped_column(Text)           # URL or gradient key
    content: Mapped[dict] = mapped_column(J, default=dict)       # Tiptap JSON doc
    parent_page_id: Mapped[Optional[str]] = mapped_column(ForeignKey("pages.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)


class InboxEvent(Base, IdMixin, TimestampMixin):
    """Canonical Inbox event — the single primitive backing the global Brain
    Inbox and the Notevoro internal Mail/Send system.

    An InboxEvent NEVER duplicates an object; it references it. When a share
    is accepted, the recipient's access is granted on the CANONICAL object
    (via that object's `shared_with` or a space membership row) — not by
    copying content.

    event_type:
      'mail'         -> free-form async message (subject+body)
      'share'        -> a sender shared a specific object with the recipient
      'invitation'   -> the sender invited the recipient to a Team Space
      'mention'      -> the recipient was @-mentioned in an object/message
      'activity'     -> notable activity in a Space the recipient watches
      'system'       -> platform/system event (no source_space_id)
    """
    __tablename__ = "inbox_events"
    __table_args__ = (
        Index("ix_inbox_recipient_created", "recipient_id", "created_at"),
        Index("ix_inbox_recipient_read", "recipient_id", "read_at"),
        Index("ix_inbox_recipient_space", "recipient_id", "source_space_id"),
        CheckConstraint(
            "event_type IN ('mail','share','invitation','mention','activity','system')",
            name="ck_inbox_event_type",
        ),
        CheckConstraint(
            "status IN ('pending','accepted','declined','archived')",
            name="ck_inbox_status",
        ),
    )
    recipient_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    source_space_id: Mapped[Optional[str]] = mapped_column(ForeignKey("spaces.id", ondelete="SET NULL"), index=True)
    event_type: Mapped[str] = mapped_column(String(24), nullable=False)
    subject: Mapped[Optional[str]] = mapped_column(String(300))
    body: Mapped[Optional[str]] = mapped_column(Text)
    object_type: Mapped[Optional[str]] = mapped_column(String(32))   # 'page' | 'document' | 'note' | 'project' | 'task' | 'file' | 'meeting' | 'invitation'
    object_id: Mapped[Optional[str]] = mapped_column(String(36))
    permission: Mapped[Optional[str]] = mapped_column(String(16))    # 'viewer' | 'editor' when share
    link: Mapped[Optional[str]] = mapped_column(Text)                # deep-link if applicable
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    meta: Mapped[dict] = mapped_column(J, default=dict)


class Activity(Base, IdMixin, TimestampMixin):
    __tablename__ = "activities"
    __table_args__ = (Index("ix_activity_space_created", "space_id", "created_at"),)
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(60), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(36))
    summary: Mapped[str] = mapped_column(String(400), nullable=False)
    meta: Mapped[dict] = mapped_column(J, default=dict)


class Subscription(Base, IdMixin, TimestampMixin):
    __tablename__ = "subscriptions"
    __table_args__ = (CheckConstraint("plan IN ('free','pro','premium','enterprise')", name="ck_plan"),)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(20), default="free", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    provider_subscription_id: Mapped[Optional[str]] = mapped_column(String(120))
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    grace_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    seats: Mapped[int] = mapped_column(Integer, default=1)


class UsageCounter(Base, IdMixin):
    __tablename__ = "usage_counters"
    __table_args__ = (UniqueConstraint("user_id", "resource_type", "period", name="uq_usage_counter"),)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    period: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class UsageRecord(Base, IdMixin, TimestampMixin):
    __tablename__ = "usage_records"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    space_id: Mapped[Optional[str]] = mapped_column(String(36))
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    period: Mapped[str] = mapped_column(String(20), nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(120), unique=True)
    meta: Mapped[dict] = mapped_column(J, default=dict)


class BillingEvent(Base, IdMixin, TimestampMixin):
    __tablename__ = "billing_events"
    event_id: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    type: Mapped[str] = mapped_column(String(60), nullable=False)
    payload: Mapped[dict] = mapped_column(J, default=dict)


class VoroAction(Base, IdMixin, TimestampMixin):
    __tablename__ = "voro_actions"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    space_id: Mapped[Optional[str]] = mapped_column(ForeignKey("spaces.id", ondelete="CASCADE"), index=True)
    action_type: Mapped[str] = mapped_column(String(60), nullable=False)
    context: Mapped[dict] = mapped_column(J, default=dict)
    confirmation_required: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    result: Mapped[Optional[dict]] = mapped_column(J)
    error: Mapped[Optional[str]] = mapped_column(Text)


class VoroMessage(Base, IdMixin, TimestampMixin):
    __tablename__ = "voro_messages"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    space_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    agent: Mapped[str] = mapped_column(String(30), default="voro")
    actions: Mapped[list] = mapped_column(J, default=list)


class Integration(Base, IdMixin, TimestampMixin):
    __tablename__ = "integrations"
    __table_args__ = (UniqueConstraint("space_id", "provider", name="uq_integration"),)
    space_id: Mapped[str] = mapped_column(ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="disconnected")
    account: Mapped[Optional[str]] = mapped_column(String(200))
    permissions: Mapped[list] = mapped_column(J, default=list)
    config: Mapped[dict] = mapped_column(J, default=dict)
    connected_by: Mapped[Optional[str]] = mapped_column(String(36))
    connected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class AuditLog(Base, IdMixin, TimestampMixin):
    __tablename__ = "audit_logs"
    user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
    space_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    outcome: Mapped[str] = mapped_column(String(20), nullable=False)
    request_id: Mapped[Optional[str]] = mapped_column(String(60))
    meta: Mapped[dict] = mapped_column(J, default=dict)


class IdempotencyKey(Base, IdMixin, TimestampMixin):
    __tablename__ = "idempotency_keys"
    __table_args__ = (UniqueConstraint("user_id", "key", name="uq_idem"),)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    key: Mapped[str] = mapped_column(String(120), nullable=False)
    response: Mapped[dict] = mapped_column(J, default=dict)
    status_code: Mapped[int] = mapped_column(Integer, default=200)
