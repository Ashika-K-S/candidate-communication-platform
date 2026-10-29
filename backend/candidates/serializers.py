import re
from rest_framework import serializers
from .models import Candidate


class CandidateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidate
        fields = [
            "id",
            "name",
            "email",
            "phone",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Name cannot be empty or whitespace.")
        return name

    def validate_email(self, value):
        email = value.strip().lower()
        if not email:
            raise serializers.ValidationError("Email cannot be empty.")
        return email

    def validate_phone(self, value):
        phone = value.strip()
        if not phone:
            raise serializers.ValidationError("Phone number cannot be empty.")
        # Ensure phone has valid telephone characters (+, digits, spaces, hyphens, parentheses)
        if not re.match(r"^(\+?[0-9\s\-\(\)]{7,20})$", phone):
            raise serializers.ValidationError(
                "Phone number must contain between 7 and 20 valid characters (digits, +, -, spaces, parentheses)."
            )
        # Check that there are at least 7 digits
        digits = re.sub(r"\D", "", phone)
        if len(digits) < 7:
            raise serializers.ValidationError("Phone number must contain at least 7 digits.")
        return phone
