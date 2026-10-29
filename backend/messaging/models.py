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
    Tracks provider references, statuses, and failure details.
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

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Message {self.id} -> Candidate {self.candidate_id} [{self.status}]"
