"""Shared LLM helper. Prefers native OpenAI (with tools) when OPENAI_API_KEY is set,
otherwise falls back to the Emergent universal key via emergentintegrations."""
import os
from dotenv import load_dotenv
from .config import settings

load_dotenv()


def ai_available() -> bool:
    return bool(settings.openai_api_key or os.environ.get("EMERGENT_LLM_KEY"))


def ai_provider() -> str:
    if settings.openai_api_key:
        return "openai"
    if os.environ.get("EMERGENT_LLM_KEY"):
        return "emergent"
    return "none"


async def emergent_reply(session_id: str, system_message: str, transcript: list, user_text: str) -> str:
    """Non-streaming reply using the Emergent universal key. `transcript` is a list of
    (role, content) tuples for prior turns which we fold into the system prompt so a
    fresh LlmChat instance still has conversational context."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    key = os.environ.get("EMERGENT_LLM_KEY")
    model = os.environ.get("EMERGENT_MODEL", "gpt-5.4")
    sys = system_message
    if transcript:
        convo = "\n".join(f"{'User' if r == 'user' else 'Assistant'}: {c}" for r, c in transcript[-8:])
        sys = system_message + "\n\nRECENT CONVERSATION:\n" + convo
    chat = LlmChat(api_key=key, session_id=session_id, system_message=sys).with_model("openai", model)
    resp = await chat.send_message(UserMessage(text=user_text))
    return resp if isinstance(resp, str) else str(resp)


async def ai_complete(session_id: str, system_message: str, user_text: str) -> str:
    """One-shot completion used by agents / workflows. Uses whichever provider is available."""
    if settings.openai_api_key:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        resp = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "system", "content": system_message}, {"role": "user", "content": user_text}],
            max_tokens=900, temperature=0.4)
        return resp.choices[0].message.content or ""
    return await emergent_reply(session_id, system_message, [], user_text)
