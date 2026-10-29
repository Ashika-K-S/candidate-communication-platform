from django.db.models import Q
from rest_framework import filters, viewsets
from .models import Candidate
from .serializers import CandidateSerializer


class CandidateViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing candidates.
    Supports CRUD operations and case-insensitive search by name, email, or phone.
    """
    queryset = Candidate.objects.all()
    serializer_class = CandidateSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "email", "phone"]
    ordering_fields = ["name", "email", "phone", "created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        query = self.request.query_params.get("q")
        if query:
            clean_query = query.strip()
            if clean_query:
                queryset = queryset.filter(
                    Q(name__icontains=clean_query)
                    | Q(email__icontains=clean_query)
                    | Q(phone__icontains=clean_query)
                )
        return queryset
