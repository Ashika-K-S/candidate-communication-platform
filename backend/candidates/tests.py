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
