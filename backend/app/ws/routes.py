import asyncio
from collections.abc import Callable
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.stream.pipeline import get_events_since, get_live_metrics

router = APIRouter()


def _parse_last_sequence(websocket: WebSocket) -> int:
    raw_last_sequence = websocket.query_params.get("last_sequence")
    if raw_last_sequence is None:
        return 0

    try:
        parsed_value = int(raw_last_sequence)
    except ValueError:
        return 0

    return max(parsed_value, 0)


async def _stream_events(
    websocket: WebSocket,
    message_type: str,
    event_filter: Callable[[dict[str, Any]], bool],
) -> None:
    last_sequence = _parse_last_sequence(websocket)
    await websocket.accept()

    try:
        while True:
            events = get_events_since(last_sequence=last_sequence, limit=250)

            for item in events:
                payload = item["payload"]
                if not event_filter(payload):
                    continue

                await websocket.send_json(
                    {
                        "type": message_type,
                        "sequence": item["sequence"],
                        "data": payload,
                    }
                )

            if events:
                last_sequence = events[-1]["sequence"]

            await asyncio.sleep(0.75)
    except WebSocketDisconnect:
        return


@router.websocket("/ws/logs")
async def ws_logs(websocket: WebSocket) -> None:
    await _stream_events(
        websocket=websocket,
        message_type="log",
        event_filter=lambda _: True,
    )


@router.websocket("/ws/anomalies")
async def ws_anomalies(websocket: WebSocket) -> None:
    await _stream_events(
        websocket=websocket,
        message_type="anomaly",
        event_filter=lambda payload: bool(payload.get("is_anomaly", False)),
    )


@router.websocket("/ws/metrics")
async def ws_metrics(websocket: WebSocket) -> None:
    await websocket.accept()

    try:
        while True:
            await websocket.send_json(
                {
                    "type": "metrics",
                    "data": get_live_metrics(window_size=300),
                }
            )
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        return