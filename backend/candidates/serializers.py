import re
import unicodedata
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
            raise serializers.ValidationError("Full name is required.")
        if len(name) < 2:
            raise serializers.ValidationError("Full name must be at least 2 characters.")
        if len(name) > 150:
            raise serializers.ValidationError("Full name cannot exceed 150 characters.")

        # Reject names containing only numbers or symbols
        has_letter = any(char.isalpha() for char in name)
        if not has_letter:
            raise serializers.ValidationError("Full name must contain letters and cannot consist solely of numbers or symbols.")

        # Reject names containing numbers
        if any(char.isdigit() for char in name):
            raise serializers.ValidationError("Full name cannot contain numeric digits.")

        # Allow legitimate names containing spaces, hyphens, apostrophes, periods, and Unicode letters
        for char in name:
            cat = unicodedata.category(char)
            if not (cat.startswith("L") or char in " -'."):
                raise serializers.ValidationError(
                    "Full name contains invalid characters. Only letters, spaces, hyphens, apostrophes, and periods are allowed."
                )

        return name

    def validate_email(self, value):
        email = value.strip().lower()
        if not email:
            raise serializers.ValidationError("Email address is required.")
        if len(email) > 254:
            raise serializers.ValidationError("Email address cannot exceed 254 characters.")

        # Validate standard RFC email format
        email_pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$"
        if not re.match(email_pattern, email):
            raise serializers.ValidationError("Enter a valid email address.")

        return email

    def validate_phone(self, value):
        phone = value.strip()
        if not phone:
            raise serializers.ValidationError("Phone number is required.")

        # Reject alphabetic characters
        if re.search(r"[a-zA-Z]", phone):
            raise serializers.ValidationError("Phone number cannot contain alphabetic characters.")

        # Validate supported characters (digits, +, spaces, hyphens, parentheses, dots)
        if not re.match(r"^\+?[0-9\s\-\(\)\.]+$", phone):
            raise serializers.ValidationError("Phone number contains invalid symbols. Only digits, +, -, and spaces are allowed.")

        digits = re.sub(r"\D", "", phone)
        if len(digits) < 10:
            raise serializers.ValidationError("Phone number must contain at least 10 digits.")
        if len(digits) > 15:
            raise serializers.ValidationError("Phone number cannot exceed 15 digits.")

        # Normalize accepted values consistently into E.164 format before saving
        if phone.startswith("+"):
            normalized = f"+{digits}"
        elif len(digits) == 10:
            # 10-digit national number (e.g. Indian mobile) normalized with +91 prefix
            normalized = f"+91{digits}"
        elif digits.startswith("91") and len(digits) == 12:
            normalized = f"+{digits}"
        else:
            normalized = f"+{digits}"

        if len(normalized) > 20:
            raise serializers.ValidationError("Normalized phone number exceeds the 20-character maximum length.")

        return normalized

