from django.contrib import admin
from .models import DeliveryStatusEvent, Message, MessageRetryAttempt


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "candidate",
        "status",
        "retry_count",
        "is_permanent_failure",
        "provider",
        "provider_message_id",
        "created_at",
    )
    list_filter = ("status", "is_permanent_failure", "provider", "created_at")
    search_fields = (
        "candidate__name",
        "candidate__phone",
        "candidate__email",
        "content",
        "provider_message_id",
    )
    readonly_fields = ("created_at", "updated_at")


@admin.register(DeliveryStatusEvent)
class DeliveryStatusEventAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "event_id",
        "message",
        "status",
        "provider_message_id",
        "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = ("event_id", "provider_message_id", "failure_reason")
    readonly_fields = ("created_at",)


@admin.register(MessageRetryAttempt)
class MessageRetryAttemptAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "message",
        "attempt_number",
        "previous_status",
        "status",
        "forced",
        "is_permanent_failure",
        "created_at",
    )
    list_filter = ("status", "forced", "is_permanent_failure", "created_at")
    search_fields = ("message__id", "failure_reason", "new_provider_message_id")
    readonly_fields = ("created_at",)
