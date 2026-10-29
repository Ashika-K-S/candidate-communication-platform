from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import CandidateMessagesView, MessageViewSet

router = DefaultRouter()
router.register(r"messages", MessageViewSet, basename="message")

urlpatterns = router.urls + [
    path(
        "candidates/<int:candidate_id>/messages/",
        CandidateMessagesView.as_view(),
        name="candidate-messages",
    ),
]
