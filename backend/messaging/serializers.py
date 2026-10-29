from rest_framework import serializers
from candidates.models import Candidate
from .models import Message, MessageStatus


class MessageSerializer(serializers.ModelSerializer):
    candidate_name = serializers.CharField(source="candidate.name", read_only=True)
    candidate_email = serializers.CharField(source="candidate.email", read_only=True)
    candidate_phone = serializers.CharField(source="candidate.phone", read_only=True)

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
        # Deduplicate while preserving order
        seen = set()
        deduped = []
        for cid in value:
            if cid not in seen:
                seen.add(cid)
                deduped.append(cid)
        return deduped
