import logging
import requests
from django.conf import settings
from .models import Message, MessageStatus

logger = logging.getLogger(__name__)


def send_to_dummy_provider(recipient: str, content: str) -> dict:
    """
    Sends an outbound message to the external dummy provider service via HTTP REST.
    Handles network errors, timeouts, and provider error codes gracefully.
    """
    base_url = getattr(settings, "PROVIDER_BASE_URL", "http://127.0.0.1:8001").rstrip("/")
    timeout = getattr(settings, "PROVIDER_TIMEOUT", 10.0)
    url = f"{base_url}/api/send/"

    payload = {
        "recipient": recipient,
        "content": content,
    }

    try:
        response = requests.post(
            url,
            json=payload,
            timeout=timeout,
            headers={"Content-Type": "application/json"},
        )

        try:
            data = response.json()
        except Exception:
            data = {"message": response.text}

        if response.status_code == 200:
            return {
                "success": True,
                "status": MessageStatus.SENT,
                "provider_id": data.get("provider_id"),
                "data": data,
            }
        else:
            error_message = (
                data.get("message")
                or data.get("error")
                or f"Provider returned HTTP {response.status_code}"
            )
            return {
                "success": False,
                "status": MessageStatus.FAILED,
                "failure_reason": str(error_message),
                "data": data,
            }

    except requests.exceptions.Timeout:
        logger.warning("Provider request timed out for recipient %s", recipient)
        return {
            "success": False,
            "status": MessageStatus.FAILED,
            "failure_reason": f"Provider connection timed out after {timeout} seconds.",
        }
    except requests.exceptions.ConnectionError:
        logger.warning("Provider connection error for %s", url)
        return {
            "success": False,
            "status": MessageStatus.FAILED,
            "failure_reason": f"Unable to connect to dummy provider service at {url}.",
        }
    except requests.exceptions.RequestException as e:
        logger.error("Provider request exception: %s", str(e))
        return {
            "success": False,
            "status": MessageStatus.FAILED,
            "failure_reason": f"Communication provider error: {str(e)}",
        }


def dispatch_candidate_message(candidate, content: str, provider_name: str = "dummy_provider") -> Message:
    """
    Persists a Message record and dispatches it to the dummy provider.
    Updates the record with provider ID or failure reason.
    """
    message = Message.objects.create(
        candidate=candidate,
        content=content,
        provider=provider_name,
        status=MessageStatus.PENDING,
    )

    recipient = candidate.phone or candidate.email
    result = send_to_dummy_provider(recipient=recipient, content=content)

    if result.get("success"):
        message.status = MessageStatus.SENT
        message.provider_message_id = result.get("provider_id")
        message.failure_reason = None
    else:
        message.status = MessageStatus.FAILED
        message.failure_reason = result.get("failure_reason")

    message.save(update_fields=["status", "provider_message_id", "failure_reason", "updated_at"])
    return message
