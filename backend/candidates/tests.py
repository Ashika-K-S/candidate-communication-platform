from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .models import Candidate


class CandidateAPITests(APITestCase):
    def setUp(self):
        self.list_create_url = reverse("candidate-list")
        self.candidate1 = Candidate.objects.create(
            name="Alice Walker",
            email="alice@example.com",
            phone="+1234567890",
        )
        self.candidate2 = Candidate.objects.create(
            name="Bob Smith",
            email="bob@example.com",
            phone="+9876543210",
        )

    def test_create_candidate_success(self):
        payload = {
            "name": "Charlie Brown",
            "email": "charlie@example.com",
            "phone": "+1122334455",
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("id", response.data)
        self.assertEqual(response.data["name"], "Charlie Brown")
        self.assertEqual(response.data["email"], "charlie@example.com")
        self.assertEqual(response.data["phone"], "+1122334455")
        self.assertIn("created_at", response.data)
        self.assertIn("updated_at", response.data)
        self.assertTrue(Candidate.objects.filter(email="charlie@example.com").exists())

    def test_create_candidate_missing_fields(self):
        # Missing email and phone
        response = self.client.post(self.list_create_url, {"name": "No Info"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)
        self.assertIn("phone", response.data)

    def test_create_candidate_blank_name(self):
        payload = {
            "name": "   ",
            "email": "blank@example.com",
            "phone": "+1234567000",
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)

    def test_create_candidate_invalid_email(self):
        payload = {
            "name": "Bad Email User",
            "email": "not-an-email",
            "phone": "+1234567000",
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_create_candidate_invalid_phone(self):
        payload = {
            "name": "Bad Phone User",
            "email": "badphone@example.com",
            "phone": "abc-def",
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)

    def test_create_candidate_duplicate_email(self):
        payload = {
            "name": "Duplicate Alice",
            "email": "alice@example.com",
            "phone": "+1999888777",
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_create_candidate_duplicate_phone(self):
        payload = {
            "name": "Duplicate Phone Candidate",
            "email": "newunique@example.com",
            "phone": "+1234567890",  # Alice's phone
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)

    def test_list_candidates(self):
        response = self.client.get(self.list_create_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should contain at least our 2 candidates
        emails = [c["email"] for c in response.data]
        self.assertIn("alice@example.com", emails)
        self.assertIn("bob@example.com", emails)

    def test_retrieve_candidate_success(self):
        detail_url = reverse("candidate-detail", kwargs={"pk": self.candidate1.pk})
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Alice Walker")
        self.assertEqual(response.data["email"], "alice@example.com")

    def test_retrieve_candidate_not_found(self):
        detail_url = reverse("candidate-detail", kwargs={"pk": 999999})
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_candidate_put(self):
        detail_url = reverse("candidate-detail", kwargs={"pk": self.candidate1.pk})
        payload = {
            "name": "Alice Cooper",
            "email": "alice.cooper@example.com",
            "phone": "+1234567899",
        }
        response = self.client.put(detail_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.candidate1.refresh_from_db()
        self.assertEqual(self.candidate1.name, "Alice Cooper")
        self.assertEqual(self.candidate1.email, "alice.cooper@example.com")
        self.assertEqual(self.candidate1.phone, "+1234567899")

    def test_update_candidate_patch(self):
        detail_url = reverse("candidate-detail", kwargs={"pk": self.candidate1.pk})
        payload = {"name": "Alice In Chains"}
        response = self.client.patch(detail_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.candidate1.refresh_from_db()
        self.assertEqual(self.candidate1.name, "Alice In Chains")
        # Ensure email remained untouched
        self.assertEqual(self.candidate1.email, "alice@example.com")

    def test_update_candidate_duplicate_email(self):
        detail_url = reverse("candidate-detail", kwargs={"pk": self.candidate1.pk})
        # Attempt to change candidate1's email to candidate2's email
        response = self.client.patch(detail_url, {"email": "bob@example.com"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_delete_candidate_success(self):
        detail_url = reverse("candidate-detail", kwargs={"pk": self.candidate1.pk})
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Candidate.objects.filter(pk=self.candidate1.pk).exists())

    def test_delete_candidate_not_found(self):
        detail_url = reverse("candidate-detail", kwargs={"pk": 999999})
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_search_candidate_by_name(self):
        response = self.client.get(self.list_create_url, {"search": "Walker"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["email"], "alice@example.com")

    def test_search_candidate_by_email(self):
        response = self.client.get(self.list_create_url, {"search": "bob@example"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Bob Smith")

    def test_search_candidate_by_phone(self):
        response = self.client.get(self.list_create_url, {"search": "9876543210"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Bob Smith")

    def test_search_candidate_via_q_parameter(self):
        response = self.client.get(self.list_create_url, {"q": "Alice"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["email"], "alice@example.com")

    def test_search_no_results(self):
        response = self.client.get(self.list_create_url, {"search": "NonExistentPerson"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_create_candidate_name_with_numbers_rejected(self):
        payload = {
            "name": "John Doe 123",
            "email": "johndoe123@example.com",
            "phone": "+919876543211",
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)

    def test_create_candidate_name_symbols_only_rejected(self):
        payload = {
            "name": "---@@@---",
            "email": "symbolsonly@example.com",
            "phone": "+919876543212",
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)

    def test_create_candidate_name_too_short(self):
        payload = {
            "name": "J",
            "email": "tooshort@example.com",
            "phone": "+919876543213",
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)

    def test_create_candidate_name_too_long(self):
        payload = {
            "name": "A" * 151,
            "email": "toolong@example.com",
            "phone": "+919876543214",
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)

    def test_create_candidate_valid_unicode_names(self):
        payload = {
            "name": "Renée Müller",
            "email": "renee@example.com",
            "phone": "+919876543215",
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Renée Müller")

        # Hyphenated and apostrophe names
        payload2 = {
            "name": "Mary-Jane O'Connor",
            "email": "maryjane@example.com",
            "phone": "+919876543216",
        }
        response2 = self.client.post(self.list_create_url, payload2, format="json")
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response2.data["name"], "Mary-Jane O'Connor")

    def test_create_candidate_phone_fewer_than_10_digits(self):
        payload = {
            "name": "Short Phone",
            "email": "shortphone@example.com",
            "phone": "+123456789",  # 9 digits
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)

    def test_create_candidate_phone_too_many_digits(self):
        payload = {
            "name": "Long Phone",
            "email": "longphone@example.com",
            "phone": "+1234567890123456",  # 16 digits
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)

    def test_create_candidate_phone_with_letters_rejected(self):
        payload = {
            "name": "Alpha Phone",
            "email": "alphaphone@example.com",
            "phone": "9876543210abc",
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)

    def test_create_candidate_phone_with_invalid_symbols_rejected(self):
        payload = {
            "name": "Symbol Phone",
            "email": "symbolphone@example.com",
            "phone": "+91 98765-43210#*!",
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)

    def test_create_candidate_indian_number_normalized(self):
        # 10 digits without prefix normalized to +919876543210
        payload = {
            "name": "Indian Candidate",
            "email": "indian@example.com",
            "phone": "9123456780",
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["phone"], "+919123456780")

    def test_create_candidate_malformed_emails_rejected(self):
        for bad_email in ["abc", "abc@", "abc.com", "@example.com", "user@.com"]:
            payload = {
                "name": "Bad Email Candidate",
                "email": bad_email,
                "phone": "+919876543218",
            }
            response = self.client.post(self.list_create_url, payload, format="json")
            self.assertEqual(
                response.status_code,
                status.HTTP_400_BAD_REQUEST,
                f"Email '{bad_email}' should have been rejected",
            )
            self.assertIn("email", response.data)

    def test_update_candidate_invalid_phone(self):
        detail_url = reverse("candidate-detail", kwargs={"pk": self.candidate1.pk})
        response = self.client.patch(detail_url, {"phone": "invalid-phone"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)

    def test_update_candidate_duplicate_phone(self):
        detail_url = reverse("candidate-detail", kwargs={"pk": self.candidate1.pk})
        response = self.client.patch(detail_url, {"phone": self.candidate2.phone}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)

