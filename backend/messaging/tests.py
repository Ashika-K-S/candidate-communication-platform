from unittest.mock import MagicMock, patch
from django.urls import reverse
import requests
from rest_framework import status
from rest_framework.test import APITestCase
from candidates.models import Candidate
from .models import Message, MessageStatus


class MessagingAPITests(APITestCase):
    def setUp(self):
        self.candidate1 = Candidate.objects.create(
            name="Diana Prince",
            email="diana@themyscira.com",
            phone="+15551112222",
        )
        self.candidate2 = Candidate.objects.create(
            name="Clark Kent",
            email="clark@dailyplanet.com",
            phone="+15553334444",
        )
        self.candidate3 = Candidate.objects.create(
            name="Bruce Wayne",
            email="bruce@wayneenterprises.com",
            phone="+15555556666",
        )

        self.send_url = reverse("message-send-individual")
        self.bulk_send_url = reverse("message-send-bulk")
        self.messages_list_url = reverse("message-list")

    @patch("requests.post")
    def test_send_individual_message_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "sent",
            "provider_id": "prov_msg_test123",
            "recipient": self.candidate1.phone,
        }
        mock_post.return_value = mock_response

        payload = {
            "candidate_id": self.candidate1.id,
            "content": "Welcome to the interview process!",
        }
        response = self.client.post(self.send_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], MessageStatus.SENT)
        self.assertEqual(response.data["provider_message_id"], "prov_msg_test123")
        self.assertEqual(response.data["candidate"], self.candidate1.id)
        self.assertIsNone(response.data["failure_reason"])

        # Check DB persistence
        msg = Message.objects.get(id=response.data["id"])
        self.assertEqual(msg.candidate, self.candidate1)
        self.assertEqual(msg.status, MessageStatus.SENT)
        self.assertEqual(msg.provider_message_id, "prov_msg_test123")

    def test_send_individual_message_invalid_candidate(self):
        payload = {
            "candidate_id": 99999,
            "content": "Hello non-existent candidate",
        }
        response = self.client.post(self.send_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("candidate_id", response.data)
        self.assertEqual(Message.objects.count(), 0)

    def test_send_individual_message_blank_content(self):
        payload = {
            "candidate_id": self.candidate1.id,
            "content": "    ",
        }
        response = self.client.post(self.send_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("content", response.data)
        self.assertEqual(Message.objects.count(), 0)

    @patch("requests.post")
    def test_send_individual_message_provider_permanent_failure(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 422
        mock_response.json.return_value = {
            "status": "failed",
            "error": "permanent_failure",
            "message": "Recipient number is invalid or blocked.",
        }
        mock_post.return_value = mock_response

        payload = {
            "candidate_id": self.candidate1.id,
            "content": "Test message to blocked number",
        }
        response = self.client.post(self.send_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], MessageStatus.FAILED)
        self.assertEqual(response.data["failure_reason"], "Recipient number is invalid or blocked.")
        self.assertIsNone(response.data["provider_message_id"])

        # Verify record in DB
        msg = Message.objects.get(id=response.data["id"])
        self.assertEqual(msg.status, MessageStatus.FAILED)
        self.assertEqual(msg.failure_reason, "Recipient number is invalid or blocked.")

    @patch("requests.post", side_effect=requests.exceptions.Timeout("Connection timed out"))
    def test_send_individual_message_provider_timeout(self, mock_post):
        payload = {
            "candidate_id": self.candidate1.id,
            "content": "Message that times out",
        }
        response = self.client.post(self.send_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], MessageStatus.FAILED)
        self.assertIn("timed out", response.data["failure_reason"].lower())

        msg = Message.objects.get(id=response.data["id"])
        self.assertEqual(msg.status, MessageStatus.FAILED)
        self.assertIn("timed out", msg.failure_reason.lower())

    @patch("requests.post", side_effect=requests.exceptions.ConnectionError("Connection refused"))
    def test_send_individual_message_connection_error(self, mock_post):
        payload = {
            "candidate_id": self.candidate1.id,
            "content": "Message when provider is down",
        }
        response = self.client.post(self.send_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], MessageStatus.FAILED)
        self.assertIn("unable to connect", response.data["failure_reason"].lower())

    @patch("requests.post")
    def test_bulk_messaging_all_success(self, mock_post):
        def fake_post(*args, **kwargs):
            resp = MagicMock()
            resp.status_code = 200
            resp.json.return_value = {
                "status": "sent",
                "provider_id": "prov_bulk_ok",
            }
            return resp

        mock_post.side_effect = fake_post

        payload = {
            "candidate_ids": [self.candidate1.id, self.candidate2.id, self.candidate3.id],
            "content": "Global company announcement.",
        }
        response = self.client.post(self.bulk_send_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], 3)
        self.assertEqual(response.data["successful"], 3)
        self.assertEqual(response.data["failed"], 0)
        self.assertEqual(len(response.data["results"]), 3)

        # Ensure independent Message records exist for each candidate
        self.assertEqual(Message.objects.filter(content="Global company announcement.").count(), 3)

    @patch("requests.post")
    def test_bulk_messaging_mixed_success_and_failures(self, mock_post):
        # candidate1 succeeds, candidate2 gets 503 temporary failure
        def side_effect(*args, **kwargs):
            payload = kwargs.get("json", {})
            resp = MagicMock()
            if payload.get("recipient") == self.candidate1.phone:
                resp.status_code = 200
                resp.json.return_value = {"status": "sent", "provider_id": "prov_cand1"}
            else:
                resp.status_code = 503
                resp.json.return_value = {"status": "failed", "message": "Carrier down"}
            return resp

        mock_post.side_effect = side_effect

        # Include candidate1 (success), candidate2 (provider error), and 99999 (invalid candidate)
        payload = {
            "candidate_ids": [self.candidate1.id, self.candidate2.id, 99999],
            "content": "Mixed results test.",
        }
        response = self.client.post(self.bulk_send_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], 3)
        self.assertEqual(response.data["successful"], 1)
        self.assertEqual(response.data["failed"], 2)

        results = {r["candidate_id"]: r for r in response.data["results"]}
        # candidate1 succeeded
        self.assertEqual(results[self.candidate1.id]["status"], MessageStatus.SENT)
        self.assertEqual(results[self.candidate1.id]["provider_message_id"], "prov_cand1")

        # candidate2 failed due to provider error
        self.assertEqual(results[self.candidate2.id]["status"], MessageStatus.FAILED)
        self.assertEqual(results[self.candidate2.id]["failure_reason"], "Carrier down")

        # 99999 failed due to candidate not found
        self.assertEqual(results[99999]["status"], MessageStatus.FAILED)
        self.assertIn("not found", results[99999]["failure_reason"].lower())

    def test_bulk_messaging_validation_empty_candidates(self):
        payload = {
            "candidate_ids": [],
            "content": "Empty candidate list",
        }
        response = self.client.post(self.bulk_send_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("candidate_ids", response.data)

    def test_bulk_messaging_validation_blank_content(self):
        payload = {
            "candidate_ids": [self.candidate1.id],
            "content": "   ",
        }
        response = self.client.post(self.bulk_send_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("content", response.data)

    def test_candidate_communication_history(self):
        # Create messages for candidate1 and candidate2
        msg1 = Message.objects.create(
            candidate=self.candidate1,
            content="Hello Diana 1",
            status=MessageStatus.SENT,
            provider_message_id="prov_1",
        )
        msg2 = Message.objects.create(
            candidate=self.candidate1,
            content="Hello Diana 2",
            status=MessageStatus.FAILED,
            failure_reason="Temporary network failure",
        )
        msg3 = Message.objects.create(
            candidate=self.candidate2,
            content="Hello Clark",
            status=MessageStatus.SENT,
            provider_message_id="prov_2",
        )

        history_url = reverse("candidate-messages", kwargs={"candidate_id": self.candidate1.id})
        response = self.client.get(history_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        message_ids = [m["id"] for m in response.data]
        self.assertIn(msg1.id, message_ids)
        self.assertIn(msg2.id, message_ids)
        self.assertNotIn(msg3.id, message_ids)

    def test_candidate_communication_history_filter_by_status(self):
        Message.objects.create(
            candidate=self.candidate1,
            content="Message Sent",
            status=MessageStatus.SENT,
        )
        Message.objects.create(
            candidate=self.candidate1,
            content="Message Failed",
            status=MessageStatus.FAILED,
            failure_reason="Carrier rejected",
        )

        history_url = reverse("candidate-messages", kwargs={"candidate_id": self.candidate1.id})
        response = self.client.get(history_url, {"status": "failed"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["status"], MessageStatus.FAILED)
        self.assertEqual(response.data[0]["failure_reason"], "Carrier rejected")

    def test_candidate_communication_history_not_found(self):
        history_url = reverse("candidate-messages", kwargs={"candidate_id": 99999})
        response = self.client.get(history_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch("requests.post")
    def test_candidate_messages_post_endpoint(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "sent",
            "provider_id": "prov_direct_cand",
        }
        mock_post.return_value = mock_response

        history_url = reverse("candidate-messages", kwargs={"candidate_id": self.candidate1.id})
        response = self.client.post(history_url, {"content": "Direct candidate message"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], MessageStatus.SENT)
        self.assertEqual(response.data["provider_message_id"], "prov_direct_cand")

    def test_messages_list_filter_by_candidate_and_status(self):
        Message.objects.create(
            candidate=self.candidate1,
            content="Diana Sent",
            status=MessageStatus.SENT,
        )
        Message.objects.create(
            candidate=self.candidate1,
            content="Diana Failed",
            status=MessageStatus.FAILED,
        )
        Message.objects.create(
            candidate=self.candidate2,
            content="Clark Sent",
            status=MessageStatus.SENT,
        )

        # Filter by candidate and status
        response = self.client.get(self.messages_list_url, {
            "candidate": self.candidate1.id,
            "status": "sent",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["content"], "Diana Sent")

    def test_retrieve_single_message(self):
        msg = Message.objects.create(
            candidate=self.candidate1,
            content="Retrieve detail test",
            status=MessageStatus.SENT,
            provider_message_id="prov_ret_123",
        )
        detail_url = reverse("message-detail", kwargs={"pk": msg.id})
        response = self.client.get(detail_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], msg.id)
        self.assertEqual(response.data["candidate_name"], "Diana Prince")
        self.assertEqual(response.data["candidate_email"], "diana@themyscira.com")
        self.assertEqual(response.data["candidate_phone"], "+15551112222")
        self.assertEqual(response.data["content"], "Retrieve detail test")
        self.assertEqual(response.data["provider_message_id"], "prov_ret_123")

    def test_retrieve_single_message_not_found(self):
        detail_url = reverse("message-detail", kwargs={"pk": 99999})
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_search_messages_by_content_or_candidate(self):
        Message.objects.create(
            candidate=self.candidate1,
            content="UniqueInvitationAlpha",
            status=MessageStatus.SENT,
        )
        Message.objects.create(
            candidate=self.candidate2,
            content="General reminder",
            status=MessageStatus.SENT,
        )

        response = self.client.get(self.messages_list_url, {"search": "InvitationAlpha"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["candidate_name"], "Diana Prince")
