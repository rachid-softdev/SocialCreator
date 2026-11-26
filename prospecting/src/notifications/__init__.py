"""Discord notifications for pipeline runs."""

import json
from typing import Dict, Optional

from src.utils import log


def send_discord_summary(summary: Dict[str, dict]) -> None:
    """Send Discord notification with pipeline summary."""
    webhook = None
    # Load from env via config
    import os
    webhook = os.getenv("DISCORD_WEBHOOK")

    if not webhook or not webhook.startswith("http"):
        return

    lines = ["*📊 Résultat du run de prospection*: "]

    for stage, result in summary.items():
        if stage.startswith("_"):
            continue
        if not isinstance(result, dict):
            continue
        stage_name = stage.replace("_", " ").title()
        processed = result.get("processed", 0)
        errors = result.get("errors", 0)
        details = result.get("details", {})
        lines.append(
            f"*{stage_name}*: {processed} traités, {errors} erreurs. "
            f"Détails: {json.dumps(details)}"
        )

    text = "\n".join(lines)
    try:
        import requests
        response = requests.post(
            webhook,
            json={"content": text},
            timeout=10
        )
    except Exception as e:  # noqa: BLE001
        log.warning(f"Erreur envoi notification Discord: {e}")


__all__ = ["send_discord_summary"]