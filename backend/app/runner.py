import argparse
import time

import uvicorn

from app.batch.scheduler import run_batch_loop, run_batch_once
from app.stream.consumer import consume_from_kafka
from app.storage.db import SessionLocal


def run_api_mode() -> None:
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)


def run_stream_mode(interval_seconds: int = 5, max_messages: int = 500) -> None:
    print("[stream] Starting Kafka consumer loop. Press Ctrl+C to stop.")
    try:
        while True:
            db = SessionLocal()
            try:
                summary = consume_from_kafka(db=db, max_messages=max_messages)
                print(f"[stream] {summary}")
            finally:
                db.close()

            time.sleep(interval_seconds)
    except KeyboardInterrupt:
        print("[stream] Stopped.")


def run_batch_mode(run_loop: bool = False, interval_seconds: int | None = None) -> None:
    if run_loop:
        run_batch_loop(interval_seconds=interval_seconds)
        return

    summary = run_batch_once()
    print(f"[batch] {summary}")


def run_agent_mode() -> None:
    print("[agent] Phase 1 stub. RCA worker implementation comes next.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run LogPulse backend process modes")
    parser.add_argument(
        "--mode",
        choices=["api", "stream", "batch", "agent"],
        default="api",
        help="Backend process mode",
    )
    parser.add_argument(
        "--batch-loop",
        action="store_true",
        help="Run batch mode as a continuous interval loop",
    )
    parser.add_argument(
        "--batch-interval-seconds",
        type=int,
        default=None,
        help="Batch loop interval in seconds",
    )
    args = parser.parse_args()

    if args.mode == "api":
        run_api_mode()
        return

    if args.mode == "stream":
        run_stream_mode()
        return

    if args.mode == "batch":
        run_batch_mode(
            run_loop=args.batch_loop,
            interval_seconds=args.batch_interval_seconds,
        )
        return

    run_agent_mode()


if __name__ == "__main__":
    main()
