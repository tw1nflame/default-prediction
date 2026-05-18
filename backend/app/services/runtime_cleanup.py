from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from pathlib import Path


logger = logging.getLogger(__name__)

ONE_DAY_SECONDS = 24 * 60 * 60


def delete_old_runtime_files(runtime_root: Path, *, max_age_seconds: int = ONE_DAY_SECONDS) -> int:
    runtime_root = runtime_root.resolve()
    if not runtime_root.exists():
        return 0

    cutoff = time.time() - max_age_seconds
    deleted = 0

    for path in runtime_root.rglob("*"):
        try:
            if not path.is_file():
                continue

            if path.stat().st_mtime > cutoff:
                continue

            path.unlink()
            deleted += 1
        except FileNotFoundError:
            continue
        except OSError:
            logger.exception("Failed to delete old runtime file: %s", path)

    return deleted


async def run_daily_runtime_cleanup(runtime_root: Path) -> None:
    while True:
        deleted = await asyncio.to_thread(delete_old_runtime_files, runtime_root)
        if deleted:
            logger.info("Deleted %s old runtime files", deleted)

        await asyncio.sleep(ONE_DAY_SECONDS)


async def stop_runtime_cleanup(task: asyncio.Task[None]) -> None:
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task
