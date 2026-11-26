"""Cross-process runner lock to prevent overlapping pipeline runs."""

import os
import sys
import time
from pathlib import Path
from typing import Optional

from src.utils import log


class RunnerLock:
    """File-based lock to prevent concurrent pipeline runs across processes/runners.

    Uses file locking (fcntl on Unix, msvcrt on Windows) plus a host tag
    to identify which runner holds the lock.
    """

    @staticmethod
    def acquire_or_skip(lock_path: str, runner_host: str, timeout: int = 0) -> bool:
        """Try to acquire the lock. Returns False if another runner holds it.

        Args:
            lock_path: Path to the lock file.
            runner_host: Identifier for this runner (e.g. "github", "local").
            timeout: Seconds to wait for lock (0 = non-blocking).

        Returns:
            True if lock acquired, False if skipped.
        """
        Path(lock_path).parent.mkdir(parents=True, exist_ok=True)

        if sys.platform == "win32":
            return RunnerLock._acquire_windows(lock_path, runner_host, timeout)
        else:
            return RunnerLock._acquire_unix(lock_path, runner_host, timeout)

    @staticmethod
    def _acquire_unix(lock_path: str, runner_host: str, timeout: int = 0) -> bool:
        import fcntl
        try:
            lock_file = open(lock_path, "w+")
        except Exception as e:
            log.warning(f"Impossible d'ouvrir le fichier de verrou {lock_path}: {e}")
            return False

        try:
            flags = fcntl.LOCK_EX | (fcntl.LOCK_NB if timeout == 0 else 0)
            fcntl.flock(lock_file, flags)
        except BlockingIOError:
            log.warning(f"Un autre runner détient le verrou, on passe")
            lock_file.close()
            return False
        except Exception as e:
            log.warning(f"Erreur lors de l'acquisition du verrou: {e}")
            lock_file.close()
            return False

        lock_file.seek(0)
        lock_file.truncate()
        lock_file.write(runner_host)
        lock_file.flush()
        lock_file.seek(0)

        return True

    @staticmethod
    def _acquire_windows(lock_path: str, runner_host: str, timeout: int = 0) -> bool:
        try:
            import msvcrt
            lock_file = open(lock_path, "w+")
        except Exception as e:
            log.warning(f"Impossible d'ouvrir le fichier de verrou {lock_path}: {e}")
            return False

        try:
            msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
        except IOError:
            log.warning(f"Un autre runner détient le verrou, on passe")
            lock_file.close()
            return False

        lock_file.seek(0)
        lock_file.truncate()
        lock_file.write(runner_host)
        lock_file.flush()

        return True

    @staticmethod
    def release(lock_path: str) -> None:
        """Release the lock."""
        try:
            Path(lock_path).unlink(missing_ok=True)
        except Exception:  # noqa: BLE001
            pass


__all__ = ["RunnerLock"]