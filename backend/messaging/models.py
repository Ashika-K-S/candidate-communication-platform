from django.db import models
from candidates.models import Candidate


class MessageStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SENT = "sent", "Sent"
    DELIVERED = "delivered", "Delivered"
    READ = "read", "Read"
    FAILED = "failed", "Failed"


class Message(models.Model):
    """
    Represents a communication message associated with a candidate.
    Tracks provider references, statuses, failure details, and retry count.
    """
    candidate = models.ForeignKey(
        Candidate,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    content = models.TextField()
    provider = models.CharField(max_length=50, default="dummy_provider")
    provider_message_id = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=MessageStatus.choices,
        default=MessageStatus.PENDING,
        db_index=True,
    )
    failure_reason = models.TextField(blank=True, null=True)
    is_permanent_failure = models.BooleanField(default=False, db_index=True)
    retry_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Message {self.id} -> Candidate {self.candidate_id} [{self.status}]"


class DeliveryStatusEvent(models.Model):
    """
    Persisted log of delivery status events (webhooks/callbacks) received from the provider.
    Enforces idempotency via a unique constraint on event_id.
    """
    event_id = models.CharField(max_length=120, unique=True, db_index=True)
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="delivery_events",
    )
    status = models.CharField(
        max_length=20,
        choices=MessageStatus.choices,
    )
    provider_message_id = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    failure_reason = models.TextField(blank=True, null=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"DeliveryEvent {self.event_id} -> Message {self.message_id} [{self.status}]"


class MessageRetryAttempt(models.Model):
    """
    Auditable log of retry attempts on failed messages.
    Tracks previous/new provider IDs, outcome, and whether forced.
    """
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="retry_attempts",
    )
    attempt_number = models.PositiveIntegerField()
    previous_status = models.CharField(max_length=20)
    previous_provider_message_id = models.CharField(max_length=100, blank=True, null=True)
    new_provider_message_id = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=MessageStatus.choices,
    )
    failure_reason = models.TextField(blank=True, null=True)
    is_permanent_failure = models.BooleanField(default=False)
    forced = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"RetryAttempt #{self.attempt_number} for Message {self.message_id} -> {self.status}"
