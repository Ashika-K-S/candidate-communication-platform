from rest_framework import serializers
from candidates.models import Candidate
from .models import DeliveryStatusEvent, Message, MessageRetryAttempt, MessageStatus


class MessageRetryAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageRetryAttempt
        fields = [
            "id",
            "attempt_number",
            "previous_status",
            "previous_provider_message_id",
            "new_provider_message_id",
            "status",
            "failure_reason",
            "is_permanent_failure",
            "forced",
            "created_at",
        ]


class DeliveryStatusEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryStatusEvent
        fields = [
            "id",
            "event_id",
            "status",
            "provider_message_id",
            "failure_reason",
            "raw_payload",
            "created_at",
        ]


class MessageSerializer(serializers.ModelSerializer):
    candidate_name = serializers.CharField(source="candidate.name", read_only=True)
    candidate_email = serializers.CharField(source="candidate.email", read_only=True)
    candidate_phone = serializers.CharField(source="candidate.phone", read_only=True)
    retry_attempts = MessageRetryAttemptSerializer(many=True, read_only=True)
    delivery_events = DeliveryStatusEventSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "candidate",
            "candidate_name",
            "candidate_email",
            "candidate_phone",
            "content",
            "provider",
            "provider_message_id",
            "status",
            "failure_reason",
            "is_permanent_failure",
            "retry_count",
            "retry_attempts",
            "delivery_events",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "candidate_name",
            "candidate_email",
            "candidate_phone",
            "provider",
            "provider_message_id",
            "status",
            "failure_reason",
            "is_permanent_failure",
            "retry_count",
            "retry_attempts",
            "delivery_events",
            "created_at",
            "updated_at",
        ]


class SendMessageSerializer(serializers.Serializer):
    candidate_id = serializers.IntegerField(required=True)
    content = serializers.CharField(required=True, allow_blank=False)

    def validate_content(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Message content cannot be blank.")
        return cleaned

    def validate_candidate_id(self, value):
        if not Candidate.objects.filter(id=value).exists():
            raise serializers.ValidationError(f"Candidate with id {value} does not exist.")
        return value


class BulkSendMessageSerializer(serializers.Serializer):
    candidate_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
        required=True,
    )
    content = serializers.CharField(required=True, allow_blank=False)

    def validate_content(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Message content cannot be blank.")
        return cleaned

    def validate_candidate_ids(self, value):
        if not value:
            raise serializers.ValidationError("candidate_ids list cannot be empty.")
        seen = set()
        deduped = []
        for cid in value:
            if cid not in seen:
                seen.add(cid)
                deduped.append(cid)
        return deduped


class DeliveryEventWebhookSerializer(serializers.Serializer):
    event_id = serializers.CharField(required=True, max_length=120)
    provider_message_id = serializers.CharField(required=False, allow_blank=True, max_length=100)
    message_id = serializers.IntegerField(required=False)
    status = serializers.ChoiceField(choices=MessageStatus.choices, required=True)
    failure_reason = serializers.CharField(required=False, allow_blank=True, default=None)
    timestamp = serializers.CharField(required=False, allow_blank=True, default=None)

    def validate_event_id(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("event_id cannot be blank.")
        return cleaned

    def validate(self, attrs):
        if not attrs.get("provider_message_id") and not attrs.get("message_id"):
            raise serializers.ValidationError(
                "Either 'provider_message_id' or 'message_id' must be provided to identify the message."
            )
        return attrs


class MessageRetrySerializer(serializers.Serializer):
    force = serializers.BooleanField(default=False, required=False)


class SimulateDeliveryEventSerializer(serializers.Serializer):
    provider_message_id = serializers.CharField(required=False, allow_blank=True, max_length=100)
    message_id = serializers.IntegerField(required=False)
    status = serializers.ChoiceField(
        choices=[MessageStatus.DELIVERED, MessageStatus.READ, MessageStatus.FAILED],
        default=MessageStatus.DELIVERED,
    )
    failure_reason = serializers.CharField(required=False, allow_blank=True, default=None)
    backend_url = serializers.URLField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get("provider_message_id") and not attrs.get("message_id"):
            raise serializers.ValidationError(
                "Either 'provider_message_id' or 'message_id' must be provided to simulate an event."
            )
        return attrs

