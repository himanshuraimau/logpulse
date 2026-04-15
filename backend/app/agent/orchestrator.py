from typing import Any

from langchain.agents import create_agent
from langchain_core.messages import AIMessage, ToolMessage
from sqlalchemy.orm import Session

from app.agent.llm import build_model_with_fallback, infer_provider_from_model_name
from app.agent.models import RCAAnalysisResult, parse_agent_output
from app.agent.tools import build_agent_tools
from app.core.config import settings
from app.stream.pipeline import get_anomaly_detail

SYSTEM_PROMPT = """
You are LogPulse RCA Agent.

You investigate one target anomaly event and produce operationally useful root-cause output.
Requirements:
1. Use tools to inspect anomaly context, service logs, anomaly patterns, and live metrics.
2. Keep findings grounded in tool evidence. Avoid speculation.
3. Respond with strict JSON only using this schema:
{
  "summary": "short summary",
  "root_cause": "most probable cause",
  "impact": "user/system impact",
  "confidence": 0.0,
  "recommendations": ["action 1", "action 2"],
  "evidence": ["fact 1", "fact 2"],
  "timeline": ["event sequence item"]
}
4. confidence must be a float between 0 and 1.
""".strip()


def _message_to_text(message: AIMessage | None) -> str:
    if message is None:
        return ""

    content = message.content
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            if isinstance(item, str):
                chunks.append(item)
                continue
            if isinstance(item, dict):
                text_value = item.get("text")
                if text_value:
                    chunks.append(str(text_value))
        return "\n".join(chunk for chunk in chunks if chunk)

    return str(content)


def _last_ai_message(messages: list[Any]) -> AIMessage | None:
    for message in reversed(messages):
        if isinstance(message, AIMessage):
            return message
    return None


def _extract_tool_trace(messages: list[Any]) -> list[dict[str, Any]]:
    traces: list[dict[str, Any]] = []

    for message in messages:
        if isinstance(message, AIMessage):
            for tool_call in message.tool_calls:
                traces.append(
                    {
                        "type": "tool_call",
                        "name": tool_call.get("name"),
                        "args": tool_call.get("args"),
                    }
                )
            continue

        if isinstance(message, ToolMessage):
            content_value = message.content
            if isinstance(content_value, list):
                content_text = "\n".join(str(item) for item in content_value)
            else:
                content_text = str(content_value)

            traces.append(
                {
                    "type": "tool_result",
                    "name": message.name,
                    "content": content_text[:700],
                }
            )

    max_trace_len = max(8, settings.agent_max_tool_calls * 3)
    return traces[:max_trace_len]


def _resolve_model_identity(
    final_message: AIMessage | None,
    llm_metadata: dict[str, Any],
) -> tuple[str, str, bool]:
    model_name = ""
    provider = llm_metadata["primary_provider"]
    fallback_used = False

    if final_message is None:
        return provider, llm_metadata["primary_model"], fallback_used

    response_metadata = final_message.response_metadata or {}
    model_name = str(response_metadata.get("model_name") or "")

    inferred_provider = infer_provider_from_model_name(model_name)
    if inferred_provider:
        provider = inferred_provider

    if llm_metadata.get("fallback_configured") and provider != llm_metadata["primary_provider"]:
        fallback_used = True

    resolved_model_name = model_name or str(
        llm_metadata.get("fallback_model") if fallback_used else llm_metadata["primary_model"]
    )
    return provider, resolved_model_name, fallback_used


def _build_user_prompt(event_id: str, anomaly_event: dict[str, Any], context_limit: int) -> str:
    return (
        "Analyze anomaly event_id="
        f"{event_id}.\n"
        f"Service: {anomaly_event.get('service')}\n"
        f"Timestamp: {anomaly_event.get('timestamp')}\n"
        f"Message: {anomaly_event.get('message')}\n"
        f"HTTP status: {anomaly_event.get('http', {}).get('status')}\n"
        f"Anomaly score: {anomaly_event.get('anomaly_score')}\n"
        f"Rule matches: {anomaly_event.get('rule_matches') or []}\n"
        f"Collect additional evidence with tools. Limit target context to roughly {context_limit} events."
    )


def run_rca_analysis(
    db: Session,
    event_id: str,
    context_limit: int,
) -> dict[str, Any]:
    anomaly_detail = get_anomaly_detail(db=db, event_id=event_id, context_limit=context_limit)
    if anomaly_detail is None:
        raise ValueError(f"Anomaly event '{event_id}' was not found.")

    anomaly_event = anomaly_detail["event"]
    service_hint = str(anomaly_event.get("service") or "").strip() or None

    llm, llm_metadata = build_model_with_fallback()
    tools = build_agent_tools(db=db, event_id=event_id, service_hint=service_hint)
    agent = create_agent(
        model=llm,
        tools=tools,
        system_prompt=SYSTEM_PROMPT,
    )

    result = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": _build_user_prompt(event_id, anomaly_event, context_limit),
                }
            ]
        }
    )

    messages = result.get("messages", [])
    final_message = _last_ai_message(messages)
    final_content = _message_to_text(final_message)
    parsed_output: RCAAnalysisResult = parse_agent_output(final_content)

    provider, model_name, fallback_used = _resolve_model_identity(final_message, llm_metadata)

    return {
        "summary": parsed_output.summary,
        "root_cause": parsed_output.root_cause,
        "impact": parsed_output.impact,
        "confidence": parsed_output.confidence,
        "recommendations": parsed_output.recommendations,
        "evidence": parsed_output.evidence,
        "timeline": parsed_output.timeline,
        "provider": provider,
        "model": model_name,
        "fallback_used": fallback_used,
        "tool_trace": _extract_tool_trace(messages),
        "raw_response": {
            "message_count": len(messages),
            "content": final_content,
        },
    }
