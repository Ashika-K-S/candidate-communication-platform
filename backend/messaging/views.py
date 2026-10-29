from django.db.models import Q
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from candidates.models import Candidate
from .models import Message, MessageStatus
from .provider import dispatch_candidate_message
from .serializers import (
    BulkSendMessageSerializer,
    MessageSerializer,
    SendMessageSerializer,
)


class MessageViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing communication history and sending messages.
    Supports filtering by status, candidate, and content search.
    """
    queryset = Message.objects.select_related("candidate").all()
    serializer_class = MessageSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["content", "candidate__name", "candidate__email", "candidate__phone"]
    ordering_fields = ["created_at", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by candidate ID (?candidate= or ?candidate_id=)
        candidate_id = self.request.query_params.get("candidate") or self.request.query_params.get("candidate_id")
        if candidate_id:
            queryset = queryset.filter(candidate_id=candidate_id)

        # Filter by status (?status=)
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
                })
            except Exception as e:
                results.append({
                    "candidate_id": cid,
                    "candidate_name": candidate.name,
                    "message_id": None,
                    "status": MessageStatus.FAILED,
                    "provider_message_id": None,
                    "failure_reason": f"Unexpected error: {str(e)}",
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

        messages = Message.objects.filter(candidate_id=candidate_id)

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
