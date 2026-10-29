import logging
import time
import requests
from django.conf import settings
from django.db import transaction
from .models import Message, MessageRetryAttempt, MessageStatus

logger = logging.getLogger(__name__)


def classify_failure(failure_reason: str = None, status_code: int = None) -> bool:
    """
    Distinguishes temporary failures from permanent failures.
    Returns True for permanent failures, False for temporary failures.
    """
    if not failure_reason and not status_code:
        return False

    reason_lower = str(failure_reason or "").lower()

    # Permanent failure keywords
    permanent_keywords = [
        "permanent",
        "perm_fail",
        "blocked",
        "invalid",
        "unreachable",
        "blacklisted",
        "does not exist",
        "not a valid",
    ]
    if any(kw in reason_lower for kw in permanent_keywords):
        return True

    # Permanent HTTP status codes (e.g., Unprocessable Entity, Bad Request)
    if status_code in (400, 404, 422):
        return True

    return False


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
                "is_permanent": False,
            }
        else:
            error_message = (
                data.get("message")
                or data.get("error")
                or f"Provider returned HTTP {response.status_code}"
            )
            is_perm = classify_failure(error_message, response.status_code)
            return {
                "success": False,
                "status": MessageStatus.FAILED,
                "failure_reason": str(error_message),
                "data": data,
                "is_permanent": is_perm,
            }

    except requests.exceptions.Timeout:
        logger.warning("Provider request timed out for recipient %s", recipient)
        return {
            "success": False,
            "status": MessageStatus.FAILED,
            "failure_reason": f"Provider connection timed out after {timeout} seconds.",
            "is_permanent": False,
        }
    except requests.exceptions.ConnectionError:
        logger.warning("Provider connection error for %s", url)
        return {
            "success": False,
            "status": MessageStatus.FAILED,
            "failure_reason": f"Unable to connect to dummy provider service at {url}.",
            "is_permanent": False,
        }
    except requests.exceptions.RequestException as e:
        logger.error("Provider request exception: %s", str(e))
        return {
            "success": False,
            "status": MessageStatus.FAILED,
            "failure_reason": f"Communication provider error: {str(e)}",
            "is_permanent": False,
        }


def check_provider_health() -> dict:
    """
    Pings the dummy provider health check endpoint over HTTP.
    Returns a structured health report including latency without exposing secrets.
    """
    base_url = getattr(settings, "PROVIDER_BASE_URL", "http://127.0.0.1:8001").rstrip("/")
    timeout = 3.0  # Quick timeout for health checks
    url = f"{base_url}/health"

    start_time = time.perf_counter()
    try:
        response = requests.get(url, timeout=timeout)
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

        if response.status_code == 200:
            try:
                data = response.json()
            except Exception:
                data = {}
            return {
                "status": "healthy",
                "provider": "dummy-provider",
                "latency_ms": latency_ms,
                "provider_info": data,
            }
        else:
            return {
                "status": "unhealthy",
                "provider": "dummy-provider",
                "latency_ms": latency_ms,
                "error": f"Provider returned HTTP status {response.status_code}.",
            }

    except requests.exceptions.Timeout:
        return {
            "status": "unhealthy",
            "provider": "dummy-provider",
            "error": f"Provider health check timed out after {timeout}s.",
        }
    except requests.exceptions.ConnectionError:
        return {
            "status": "unhealthy",
            "provider": "dummy-provider",
            "error": "Unable to connect to dummy provider service (Connection Refused).",
        }
    except requests.exceptions.RequestException as e:
        return {
            "status": "unhealthy",
            "provider": "dummy-provider",
            "error": f"Provider request error: {str(e)}",
        }


def simulate_provider_event(
    provider_message_id: str = None,
    message_id: int = None,
    status: str = "delivered",
    failure_reason: str = None,
    backend_url: str = None,
) -> tuple[bool, dict, int]:
    """
    Dispatches a webhook simulation request to the dummy provider service.
    The dummy provider formats the event payload and posts it to Django's delivery webhook.
    Returns: (is_success, response_dict, http_status_code)
    """
    base_url = getattr(settings, "PROVIDER_BASE_URL", "http://127.0.0.1:8001").rstrip("/")
    timeout = getattr(settings, "PROVIDER_TIMEOUT", 10.0)
    url = f"{base_url}/api/simulate-event/"

    payload = {
        "status": status,
    }
    if provider_message_id:
        payload["provider_message_id"] = provider_message_id
    if message_id:
        payload["message_id"] = message_id
    if failure_reason:
        payload["failure_reason"] = failure_reason
    if backend_url:
        payload["backend_url"] = backend_url

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

        return (response.status_code == 200), data, response.status_code

    except requests.exceptions.Timeout:
        return False, {
            "error": "provider_timeout",
            "message": f"Simulation request timed out after {timeout} seconds.",
        }, 504
    except requests.exceptions.ConnectionError:
        return False, {
            "error": "provider_unavailable",
            "message": f"Unable to connect to dummy provider service at {url}. Ensure the dummy provider is running on port 8001.",
        }, 503
    except requests.exceptions.RequestException as e:
        return False, {
            "error": "provider_request_error",
            "message": f"Simulation error communicating with provider: {str(e)}",
        }, 502



def dispatch_candidate_message(candidate, content: str, provider_name: str = "dummy_provider") -> Message:
    """
    Persists a Message record and dispatches it to the dummy provider.
    Updates the record with provider ID or failure reason and permanent flag.
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
        message.is_permanent_failure = False
    else:
        message.status = MessageStatus.FAILED
        message.failure_reason = result.get("failure_reason")
        message.is_permanent_failure = result.get("is_permanent", False)

    message.save(update_fields=["status", "provider_message_id", "failure_reason", "is_permanent_failure", "updated_at"])
    return message


def retry_failed_message(message_id: int, force: bool = False) -> tuple[bool, dict, int]:
    """
    Safely retries an eligible failed message inside an atomic transaction with a database row lock.
    Distinguishes temporary from permanent failures and creates an auditable MessageRetryAttempt record.
    Returns: (is_success, response_dict, http_status_code)
    """
    with transaction.atomic():
        try:
            message = Message.objects.select_for_update().get(id=message_id)
        except Message.DoesNotExist:
            return False, {"detail": f"Message with id {message_id} not found."}, 404

        # Verify eligibility: only messages with status FAILED can be retried
        if message.status != MessageStatus.FAILED:
            return False, {
                "error": "ineligible_status",
                "message": f"Message {message.id} cannot be retried because its current status is '{message.status}', not 'failed'.",
                "current_status": message.status,
            }, 400

        # Verify failure classification: permanent failures require explicit force=True
        if message.is_permanent_failure and not force:
            return False, {
                "error": "permanent_failure",
                "message": (
                    f"Message {message.id} experienced a permanent failure: '{message.failure_reason}'. "
                    "Automatic retry is disabled for permanent failures. "
                    "Provide 'force': true in the request body to explicitly override and retry."
                ),
                "is_permanent_failure": True,
            }, 400

        # Mark attempt
        attempt_number = message.retry_count + 1
        prev_status = message.status
        prev_provider_id = message.provider_message_id

        # Dispatch retry to provider
        recipient = message.candidate.phone or message.candidate.email
        result = send_to_dummy_provider(recipient=recipient, content=message.content)

        if result.get("success"):
            new_status = MessageStatus.SENT
            new_provider_id = result.get("provider_id")
            new_failure_reason = None
            new_is_perm = False
        else:
            new_status = MessageStatus.FAILED
            new_provider_id = None
            new_failure_reason = result.get("failure_reason")
            new_is_perm = result.get("is_permanent", False)

        # Audit log creation
        MessageRetryAttempt.objects.create(
            message=message,
            attempt_number=attempt_number,
            previous_status=prev_status,
            previous_provider_message_id=prev_provider_id,
            new_provider_message_id=new_provider_id,
            status=new_status,
            failure_reason=new_failure_reason,
            is_permanent_failure=new_is_perm,
            forced=force,
        )

        # Update message state
        message.retry_count = attempt_number
        message.status = new_status
        message.provider_message_id = new_provider_id
        message.failure_reason = new_failure_reason
        message.is_permanent_failure = new_is_perm
        message.save(update_fields=[
            "retry_count",
            "status",
            "provider_message_id",
            "failure_reason",
            "is_permanent_failure",
            "updated_at",
        ])

        response_data = {
            "message_id": message.id,
            "status": message.status,
            "attempt_number": attempt_number,
            "provider_message_id": message.provider_message_id,
            "failure_reason": message.failure_reason,
            "is_permanent_failure": message.is_permanent_failure,
            "forced": force,
        }
        return True, response_data, 200
