from django.contrib import admin
from .models import Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "candidate",
        "status",
        "provider",
        "provider_message_id",
        "created_at",
    )
    list_filter = ("status", "provider", "created_at")
    search_fields = (
        "candidate__name",
        "candidate__phone",
        "candidate__email",
        "content",
        "provider_message_id",
    )
    readonly_fields = ("created_at", "updated_at")
