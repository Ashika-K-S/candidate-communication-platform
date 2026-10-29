from unittest.mock import MagicMock, patch
from django.urls import reverse
import requests
from rest_framework import status
from rest_framework.test import APITestCase
from candidates.models import Candidate
from .models import DeliveryStatusEvent, Message, MessageRetryAttempt, MessageStatus


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
        self.events_url = reverse("delivery-status-events")
        self.provider_health_url = reverse("provider-health")
        self.simulate_event_url = reverse("provider-simulate-event")
        self.simulate_event_message_action_url = reverse("message-simulate-event")

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
        self.assertTrue(response.data["is_permanent_failure"])
        self.assertIsNone(response.data["provider_message_id"])

        # Verify record in DB
        msg = Message.objects.get(id=response.data["id"])
        self.assertEqual(msg.status, MessageStatus.FAILED)
        self.assertEqual(msg.failure_reason, "Recipient number is invalid or blocked.")
        self.assertTrue(msg.is_permanent_failure)

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
        self.assertEqual(results[self.candidate1.id]["status"], MessageStatus.SENT)
        self.assertEqual(results[self.candidate1.id]["provider_message_id"], "prov_cand1")

        self.assertEqual(results[self.candidate2.id]["status"], MessageStatus.FAILED)
        self.assertEqual(results[self.candidate2.id]["failure_reason"], "Carrier down")

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
        self.assertIn("retry_attempts", response.data)
        self.assertIn("delivery_events", response.data)

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

    # ==========================================
    # STAGE 3 TESTS: DELIVERY EVENTS & WEBHOOKS
    # ==========================================

    def test_webhook_status_update_delivered_success(self):
        msg = Message.objects.create(
            candidate=self.candidate1,
            content="Webhook test delivered",
            status=MessageStatus.SENT,
            provider_message_id="prov_wh_001",
        )
        payload = {
            "event_id": "evt_wh_001",
            "provider_message_id": "prov_wh_001",
            "status": "delivered",
        }
        response = self.client.post(self.events_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "updated")
        self.assertEqual(response.data["new_status"], "delivered")

        msg.refresh_from_db()
        self.assertEqual(msg.status, MessageStatus.DELIVERED)
        self.assertTrue(DeliveryStatusEvent.objects.filter(event_id="evt_wh_001").exists())

    def test_webhook_status_update_read_success(self):
        msg = Message.objects.create(
            candidate=self.candidate1,
            content="Webhook test read",
            status=MessageStatus.DELIVERED,
            provider_message_id="prov_wh_002",
        )
        payload = {
            "event_id": "evt_wh_002",
            "provider_message_id": "prov_wh_002",
            "status": "read",
        }
        response = self.client.post(self.events_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "updated")
        self.assertEqual(response.data["new_status"], "read")

        msg.refresh_from_db()
        self.assertEqual(msg.status, MessageStatus.READ)

    def test_webhook_status_update_failed_with_reason(self):
        msg = Message.objects.create(
            candidate=self.candidate1,
            content="Webhook test failed",
            status=MessageStatus.SENT,
            provider_message_id="prov_wh_003",
        )
        payload = {
            "event_id": "evt_wh_003",
            "provider_message_id": "prov_wh_003",
            "status": "failed",
            "failure_reason": "Recipient phone blocked (permanent failure)",
        }
        response = self.client.post(self.events_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["new_status"], "failed")

        msg.refresh_from_db()
        self.assertEqual(msg.status, MessageStatus.FAILED)
        self.assertEqual(msg.failure_reason, "Recipient phone blocked (permanent failure)")
        self.assertTrue(msg.is_permanent_failure)

    def test_webhook_validation_missing_event_id(self):
        payload = {
            "provider_message_id": "prov_any",
            "status": "delivered",
        }
        response = self.client.post(self.events_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("event_id", response.data)

    def test_webhook_validation_invalid_status(self):
        payload = {
            "event_id": "evt_bad_status",
            "provider_message_id": "prov_any",
            "status": "unsupported_status",
        }
        response = self.client.post(self.events_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)

    def test_webhook_validation_missing_message_identifier(self):
        payload = {
            "event_id": "evt_no_id",
            "status": "delivered",
        }
        response = self.client.post(self.events_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_webhook_message_not_found(self):
        payload = {
            "event_id": "evt_not_found",
            "provider_message_id": "non_existent_prov_id",
            "status": "delivered",
        }
        response = self.client.post(self.events_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ==========================================
    # STAGE 3 TESTS: IDEMPOTENCY & OUT-OF-ORDER
    # ==========================================

    def test_webhook_duplicate_event_id_idempotent(self):
        msg = Message.objects.create(
            candidate=self.candidate1,
            content="Idempotency test",
            status=MessageStatus.SENT,
            provider_message_id="prov_dup_1",
        )
        payload = {
            "event_id": "evt_exact_duplicate",
            "provider_message_id": "prov_dup_1",
            "status": "delivered",
        }
        # First delivery
        r1 = self.client.post(self.events_url, payload, format="json")
        self.assertEqual(r1.status_code, status.HTTP_200_OK)
        self.assertEqual(r1.data["status"], "updated")

        # Second delivery with exact same event_id
        r2 = self.client.post(self.events_url, payload, format="json")
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertEqual(r2.data["status"], "duplicate_ignored")
        self.assertIn("already been processed", r2.data["message"])

        # Exactly 1 event log row created
        self.assertEqual(DeliveryStatusEvent.objects.filter(event_id="evt_exact_duplicate").count(), 1)

    def test_webhook_out_of_order_delivered_to_sent_ignored(self):
        msg = Message.objects.create(
            candidate=self.candidate1,
            content="Out of order test",
            status=MessageStatus.DELIVERED,
            provider_message_id="prov_ooo_1",
        )
        # Event arriving with previous status 'sent'
        payload = {
            "event_id": "evt_stale_sent",
            "provider_message_id": "prov_ooo_1",
            "status": "sent",
        }
        response = self.client.post(self.events_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "stale_ignored")

        msg.refresh_from_db()
        self.assertEqual(msg.status, MessageStatus.DELIVERED)
        # Stale event was logged for audit
        self.assertTrue(DeliveryStatusEvent.objects.filter(event_id="evt_stale_sent").exists())

    def test_webhook_terminal_read_to_failed_rejected(self):
        msg = Message.objects.create(
            candidate=self.candidate1,
            content="Terminal read test",
            status=MessageStatus.READ,
            provider_message_id="prov_term_1",
        )
        payload = {
            "event_id": "evt_term_fail",
            "provider_message_id": "prov_term_1",
            "status": "failed",
            "failure_reason": "Late failure",
        }
        response = self.client.post(self.events_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "stale_ignored")

        msg.refresh_from_db()
        self.assertEqual(msg.status, MessageStatus.READ)

    def test_webhook_identical_status_no_op(self):
        msg = Message.objects.create(
            candidate=self.candidate1,
            content="Identical status test",
            status=MessageStatus.DELIVERED,
            provider_message_id="prov_ident_1",
        )
        payload = {
            "event_id": "evt_ident_001",
            "provider_message_id": "prov_ident_1",
            "status": "delivered",
        }
        response = self.client.post(self.events_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "idempotent_no_change")

    # ==========================================
    # STAGE 3 TESTS: RETRY FAILED MESSAGES
    # ==========================================

    @patch("requests.post")
    def test_retry_temporary_failed_message_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "sent",
            "provider_id": "prov_retried_ok",
        }
        mock_post.return_value = mock_response

        msg = Message.objects.create(
            candidate=self.candidate1,
            content="Temporary failure message",
            status=MessageStatus.FAILED,
            failure_reason="Carrier network congested (temporary failure)",
            is_permanent_failure=False,
            retry_count=0,
        )
        retry_url = reverse("message-retry-message", kwargs={"pk": msg.id})
        response = self.client.post(retry_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], MessageStatus.SENT)
        self.assertEqual(response.data["provider_message_id"], "prov_retried_ok")
        self.assertEqual(response.data["attempt_number"], 1)

        msg.refresh_from_db()
        self.assertEqual(msg.status, MessageStatus.SENT)
        self.assertEqual(msg.provider_message_id, "prov_retried_ok")
        self.assertEqual(msg.retry_count, 1)

        # Audit attempt
        attempt = MessageRetryAttempt.objects.filter(message=msg).first()
        self.assertIsNotNone(attempt)
        self.assertEqual(attempt.attempt_number, 1)
        self.assertEqual(attempt.previous_status, "failed")
        self.assertEqual(attempt.status, "sent")
        self.assertEqual(attempt.new_provider_message_id, "prov_retried_ok")

    def test_retry_ineligible_message_status(self):
        msg = Message.objects.create(
            candidate=self.candidate1,
            content="Already delivered message",
            status=MessageStatus.DELIVERED,
        )
        retry_url = reverse("message-retry-message", kwargs={"pk": msg.id})
        response = self.client.post(retry_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "ineligible_status")
        self.assertIn("cannot be retried", response.data["message"])

    def test_retry_permanent_failure_blocked_without_force(self):
        msg = Message.objects.create(
            candidate=self.candidate1,
            content="Permanent failure message",
            status=MessageStatus.FAILED,
            failure_reason="Recipient number is invalid or blocked (permanent failure).",
            is_permanent_failure=True,
        )
        retry_url = reverse("message-retry-message", kwargs={"pk": msg.id})
        response = self.client.post(retry_url, {"force": False}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "permanent_failure")
        self.assertIn("Automatic retry is disabled for permanent failures", response.data["message"])
        self.assertEqual(msg.retry_count, 0)

    @patch("requests.post")
    def test_retry_permanent_failure_allowed_with_force(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "sent",
            "provider_id": "prov_forced_ok",
        }
        mock_post.return_value = mock_response

        msg = Message.objects.create(
            candidate=self.candidate1,
            content="Permanent failure overridden",
            status=MessageStatus.FAILED,
            failure_reason="Blocked number",
            is_permanent_failure=True,
        )
        retry_url = reverse("message-retry-message", kwargs={"pk": msg.id})
        response = self.client.post(retry_url, {"force": True}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], MessageStatus.SENT)
        self.assertTrue(response.data["forced"])

        msg.refresh_from_db()
        self.assertEqual(msg.status, MessageStatus.SENT)
        self.assertEqual(msg.retry_count, 1)

        attempt = MessageRetryAttempt.objects.filter(message=msg).first()
        self.assertTrue(attempt.forced)

    def test_retry_message_not_found(self):
        retry_url = reverse("message-retry-message", kwargs={"pk": 99999})
        response = self.client.post(retry_url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch("requests.post")
    def test_retry_when_provider_fails_again(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 503
        mock_response.json.return_value = {
            "status": "failed",
            "message": "Still down",
        }
        mock_post.return_value = mock_response

        msg = Message.objects.create(
            candidate=self.candidate1,
            content="Retry that fails again",
            status=MessageStatus.FAILED,
            failure_reason="Carrier down",
            is_permanent_failure=False,
        )
        retry_url = reverse("message-retry-message", kwargs={"pk": msg.id})
        response = self.client.post(retry_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], MessageStatus.FAILED)
        self.assertEqual(response.data["failure_reason"], "Still down")

        msg.refresh_from_db()
        self.assertEqual(msg.status, MessageStatus.FAILED)
        self.assertEqual(msg.retry_count, 1)

    # ==========================================
    # STAGE 3 TESTS: PROVIDER HEALTH CHECK
    # ==========================================

    @patch("requests.get")
    def test_provider_health_check_healthy(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "status": "ok",
            "service": "dummy-provider",
            "version": "2.0.0",
        }
        mock_get.return_value = mock_resp

        response = self.client.get(self.provider_health_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "healthy")
        self.assertEqual(response.data["provider"], "dummy-provider")
        self.assertIn("latency_ms", response.data)

    @patch("requests.get", side_effect=requests.exceptions.Timeout)
    def test_provider_health_check_timeout(self, mock_get):
        response = self.client.get(self.provider_health_url)
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["status"], "unhealthy")
        self.assertIn("timed out", response.data["error"])

    @patch("requests.get", side_effect=requests.exceptions.ConnectionError)
    def test_provider_health_check_connection_error(self, mock_get):
        response = self.client.get(self.provider_health_url)
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["status"], "unhealthy")
        self.assertIn("Connection Refused", response.data["error"])

    # ==========================================
    # STAGE 4 TESTS: SIMULATE WEBHOOK EVENT
    # ==========================================

    @patch("requests.post")
    def test_simulate_delivery_event_success(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "simulated_event": {
                "event_id": "evt_sim_123",
                "status": "delivered",
                "provider_message_id": "prov_msg_test123",
            },
            "backend_status_code": 200,
            "backend_response": {
                "status": "updated",
                "new_status": "delivered",
            },
        }
        mock_post.return_value = mock_resp

        payload = {
            "provider_message_id": "prov_msg_test123",
            "status": "delivered",
        }
        response = self.client.post(self.simulate_event_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["backend_status_code"], 200)
        self.assertEqual(response.data["simulated_event"]["status"], "delivered")

    def test_simulate_delivery_event_missing_identifier(self):
        payload = {
            "status": "delivered",
        }
        response = self.client.post(self.simulate_event_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    @patch("requests.post", side_effect=requests.exceptions.ConnectionError)
    def test_simulate_delivery_event_provider_unavailable(self, mock_post):
        payload = {
            "provider_message_id": "prov_msg_test123",
            "status": "delivered",
        }
        response = self.client.post(self.simulate_event_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["error"], "provider_unavailable")

    @patch("requests.post", side_effect=requests.exceptions.Timeout)
    def test_simulate_delivery_event_provider_timeout(self, mock_post):
        payload = {
            "provider_message_id": "prov_msg_test123",
            "status": "delivered",
        }
        response = self.client.post(self.simulate_event_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_504_GATEWAY_TIMEOUT)
        self.assertEqual(response.data["error"], "provider_timeout")

    @patch("requests.post")
    def test_simulate_delivery_event_via_message_action(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "simulated_event": {"event_id": "evt_action_1"},
            "backend_status_code": 200,
        }
        mock_post.return_value = mock_resp

        payload = {
            "message_id": 42,
            "status": "read",
        }
        response = self.client.post(self.simulate_event_message_action_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

