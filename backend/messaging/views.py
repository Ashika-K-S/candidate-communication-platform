from django.db import transaction
from django.db.models import Q
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from candidates.models import Candidate
from .models import DeliveryStatusEvent, Message, MessageStatus
from .provider import (
    check_provider_health,
    classify_failure,
    dispatch_candidate_message,
    retry_failed_message,
    simulate_provider_event,
)
from .serializers import (
    BulkSendMessageSerializer,
    DeliveryEventWebhookSerializer,
    MessageRetrySerializer,
    MessageSerializer,
    SendMessageSerializer,
    SimulateDeliveryEventSerializer,
)

# Status ordering for normal lifecycle transitions
STATUS_PRECEDENCE = {
    MessageStatus.PENDING: 0,
    MessageStatus.SENT: 1,
    MessageStatus.DELIVERED: 2,
    MessageStatus.READ: 3,
}


class MessageViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing communication history, sending messages, and retrying failed messages.
    Supports filtering by status, candidate, and content search.
    """
    queryset = Message.objects.select_related("candidate").prefetch_related("retry_attempts", "delivery_events").all()
    serializer_class = MessageSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["content", "candidate__name", "candidate__email", "candidate__phone"]
    ordering_fields = ["created_at", "status", "retry_count"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()

        candidate_id = self.request.query_params.get("candidate") or self.request.query_params.get("candidate_id")
        if candidate_id:
            queryset = queryset.filter(candidate_id=candidate_id)

        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status__iexact=status_param.strip())

        return queryset

    @action(detail=False, methods=["post"], url_path="send")
    def send_individual(self, request):
        """
        Send a message to a single candidate.
        Endpoint: POST /api/messages/send/
        """
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        candidate_id = serializer.validated_data["candidate_id"]
        content = serializer.validated_data["content"]

        candidate = Candidate.objects.get(id=candidate_id)
        message = dispatch_candidate_message(candidate=candidate, content=content)

        response_status = status.HTTP_201_CREATED if message.status == MessageStatus.SENT else status.HTTP_200_OK
        return Response(MessageSerializer(message).data, status=response_status)

    @action(detail=False, methods=["post"], url_path="bulk-send")
    def send_bulk(self, request):
        """
        Send a message to multiple selected candidates independently.
        Endpoint: POST /api/messages/bulk-send/
        """
        serializer = BulkSendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        candidate_ids = serializer.validated_data["candidate_ids"]
        content = serializer.validated_data["content"]

        candidates_by_id = {c.id: c for c in Candidate.objects.filter(id__in=candidate_ids)}

        results = []
        for cid in candidate_ids:
            candidate = candidates_by_id.get(cid)
            if not candidate:
                results.append({
                    "candidate_id": cid,
                    "candidate_name": None,
                    "message_id": None,
                    "status": MessageStatus.FAILED,
                    "provider_message_id": None,
                    "failure_reason": f"Candidate with id {cid} not found.",
                })
                continue

            try:
                msg = dispatch_candidate_message(candidate=candidate, content=content)
                results.append({
                    "candidate_id": cid,
                    "candidate_name": candidate.name,
                    "message_id": msg.id,
                    "status": msg.status,
                    "provider_message_id": msg.provider_message_id,
                    "failure_reason": msg.failure_reason,
                    "is_permanent_failure": msg.is_permanent_failure,
                })
            except Exception as e:
                results.append({
                    "candidate_id": cid,
                    "candidate_name": candidate.name,
                    "message_id": None,
                    "status": MessageStatus.FAILED,
                    "provider_message_id": None,
                    "failure_reason": f"Unexpected error: {str(e)}",
                    "is_permanent_failure": False,
                })

        successful_count = sum(1 for r in results if r["status"] == MessageStatus.SENT)
        failed_count = sum(1 for r in results if r["status"] == MessageStatus.FAILED)

        response_data = {
            "total": len(results),
            "successful": successful_count,
            "failed": failed_count,
            "results": results,
        }
        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="retry")
    def retry_message(self, request, pk=None):
        """
        Retry an eligible failed message.
        Endpoint: POST /api/messages/<id>/retry/
        Payload: {"force": false} (optional, required if permanent failure)
        """
        serializer = MessageRetrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        force = serializer.validated_data.get("force", False)

        success, data, http_status = retry_failed_message(message_id=pk, force=force)
        return Response(data, status=http_status)

    @action(detail=False, methods=["get"], url_path="provider-health")
    def provider_health(self, request):
        """
        Check dummy provider health status.
        Endpoint: GET /api/messages/provider-health/
        """
        health_info = check_provider_health()
        resp_status = status.HTTP_200_OK if health_info.get("status") == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(health_info, status=resp_status)

    @action(detail=False, methods=["post"], url_path="events")
    def process_delivery_event(self, request):
        """
        Process a delivery-status event via Message router.
        Endpoint: POST /api/messages/events/
        """
        return DeliveryStatusWebhookView().post(request)

    @action(detail=False, methods=["post"], url_path="simulate-event")
    def simulate_event(self, request):
        """
        Simulate a delivery event via the message router.
        Endpoint: POST /api/messages/simulate-event/
        """
        return SimulateDeliveryEventView().post(request)



class CandidateMessagesView(APIView):
    """
    List or send messages directly for a specific candidate.
    GET /api/candidates/<candidate_id>/messages/
    POST /api/candidates/<candidate_id>/messages/
    """
    def get(self, request, candidate_id):
        if not Candidate.objects.filter(id=candidate_id).exists():
            return Response(
                {"detail": f"Candidate with id {candidate_id} not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        messages = Message.objects.filter(candidate_id=candidate_id).prefetch_related("retry_attempts", "delivery_events")

        status_param = request.query_params.get("status")
        if status_param:
            messages = messages.filter(status__iexact=status_param.strip())

        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, candidate_id):
        try:
            candidate = Candidate.objects.get(id=candidate_id)
        except Candidate.DoesNotExist:
            return Response(
                {"detail": f"Candidate with id {candidate_id} not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        content = request.data.get("content", "").strip()
        if not content:
            return Response(
                {"content": ["Message content cannot be blank."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        message = dispatch_candidate_message(candidate=candidate, content=content)
        response_status = status.HTTP_201_CREATED if message.status == MessageStatus.SENT else status.HTTP_200_OK
        return Response(MessageSerializer(message).data, status=response_status)


class DeliveryStatusWebhookView(APIView):
    """
    Webhook endpoint to ingest and process delivery-status events from the communication provider.
    Enforces idempotency, deduplication via event_id, and validates status transitions.
    Endpoint: POST /api/messages/events/
    """
    def post(self, request):
        serializer = DeliveryEventWebhookSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        event_id = serializer.validated_data["event_id"]
        new_status = serializer.validated_data["status"]
        provider_message_id = serializer.validated_data.get("provider_message_id")
        message_id = serializer.validated_data.get("message_id")
        failure_reason = serializer.validated_data.get("failure_reason")

        # 1. Idempotency Check: prevent duplicate event processing
        if DeliveryStatusEvent.objects.filter(event_id=event_id).exists():
            return Response(
                {
                    "status": "duplicate_ignored",
                    "message": f"Delivery event '{event_id}' has already been processed.",
                    "event_id": event_id,
                },
                status=status.HTTP_200_OK,
            )

        # 2. Database lock and state transition evaluation
        with transaction.atomic():
            # Find the message
            lookup_query = Q()
            if message_id:
                lookup_query |= Q(id=message_id)
            if provider_message_id:
                lookup_query |= Q(provider_message_id=provider_message_id)

            try:
                message = Message.objects.select_for_update().get(lookup_query)
            except Message.DoesNotExist:
                return Response(
                    {
                        "error": "message_not_found",
                        "message": "No message found matching the provided provider_message_id or message_id.",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            current_status = message.status

            # Helper to record event in the audit log
            def record_event():
                DeliveryStatusEvent.objects.create(
                    event_id=event_id,
                    message=message,
                    status=new_status,
                    provider_message_id=provider_message_id or message.provider_message_id,
                    failure_reason=failure_reason,
                    raw_payload=request.data,
                )

            # Rule A: Identical status -> Idempotent no-op
            if current_status == new_status:
                record_event()
                return Response(
                    {
                        "status": "idempotent_no_change",
                        "message": f"Message is already in '{new_status}' state.",
                        "current_status": current_status,
                        "event_id": event_id,
                    },
                    status=status.HTTP_200_OK,
                )

            # Rule B: Terminal READ state -> cannot be moved backwards or to failed
            if current_status == MessageStatus.READ:
                record_event()
                return Response(
                    {
                        "status": "stale_ignored",
                        "message": f"Message {message.id} is already in terminal state 'read'. State transition to '{new_status}' was rejected.",
                        "current_status": current_status,
                        "event_id": event_id,
                    },
                    status=status.HTTP_200_OK,
                )

            # Rule C: Terminal FAILED state -> cannot receive sent/delivered/read unless retried
            if current_status == MessageStatus.FAILED:
                record_event()
                return Response(
                    {
                        "status": "stale_ignored",
                        "message": f"Message {message.id} is marked 'failed'. Out-of-order transition to '{new_status}' was rejected.",
                        "current_status": current_status,
                        "event_id": event_id,
                    },
                    status=status.HTTP_200_OK,
                )

            # Rule D: Transition to FAILED
            if new_status == MessageStatus.FAILED:
                record_event()
                message.status = MessageStatus.FAILED
                message.failure_reason = failure_reason or "Reported failed by provider delivery event."
                message.is_permanent_failure = classify_failure(message.failure_reason)
                message.save(update_fields=["status", "failure_reason", "is_permanent_failure", "updated_at"])
                return Response(
                    {
                        "status": "updated",
                        "message_id": message.id,
                        "previous_status": current_status,
                        "new_status": message.status,
                        "event_id": event_id,
                    },
                    status=status.HTTP_200_OK,
                )

            # Rule E: Lifecycle status precedence (pending -> sent -> delivered -> read)
            curr_prec = STATUS_PRECEDENCE.get(current_status, -1)
            new_prec = STATUS_PRECEDENCE.get(new_status, -1)

            if new_prec > curr_prec:
                # Forward valid transition
                record_event()
                message.status = new_status
                message.failure_reason = None
                message.is_permanent_failure = False
                message.save(update_fields=["status", "failure_reason", "is_permanent_failure", "updated_at"])
                return Response(
                    {
                        "status": "updated",
                        "message_id": message.id,
                        "previous_status": current_status,
                        "new_status": message.status,
                        "event_id": event_id,
                    },
                    status=status.HTTP_200_OK,
                )
            else:
                # Out-of-order / Stale transition
                record_event()
                return Response(
                    {
                        "status": "stale_ignored",
                        "message": f"Out-of-order event: cannot move message status backwards from '{current_status}' to '{new_status}'.",
                        "current_status": current_status,
                        "event_id": event_id,
                    },
                    status=status.HTTP_200_OK,
                )


class ProviderHealthView(APIView):
    """
    Dedicated endpoint to check the communication provider's connectivity and latency.
    Endpoint: GET /api/provider/health/
    """
    def get(self, request):
        health_info = check_provider_health()
        http_status = status.HTTP_200_OK if health_info.get("status") == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(health_info, status=http_status)


class SimulateDeliveryEventView(APIView):
    """
    Triggers the dummy provider's delivery-status event simulation.
    Browser calls Django on port 8000 -> Django contacts dummy provider on port 8001 ->
    Dummy provider dispatches the webhook event to Django's /api/messages/events/ ->
    Idempotency and status transitions are evaluated and recorded.
    Endpoint: POST /api/provider/simulate-event/
    """
    def post(self, request):
        serializer = SimulateDeliveryEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        backend_url = serializer.validated_data.get("backend_url")
        if not backend_url:
            backend_url = request.build_absolute_uri("/api/messages/events/")

        success, data, http_status = simulate_provider_event(
            provider_message_id=serializer.validated_data.get("provider_message_id"),
            message_id=serializer.validated_data.get("message_id"),
            status=serializer.validated_data.get("status", MessageStatus.DELIVERED),
            failure_reason=serializer.validated_data.get("failure_reason"),
            backend_url=backend_url,
        )
        return Response(data, status=http_status)

