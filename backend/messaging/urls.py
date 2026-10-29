from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    CandidateMessagesView,
    DeliveryStatusWebhookView,
    MessageViewSet,
    ProviderHealthView,
    SimulateDeliveryEventView,
)

router = DefaultRouter()
router.register(r"messages", MessageViewSet, basename="message")

# Explicit paths must precede router.urls so that "messages/events/" is matched
# before the detail pattern "messages/(?P<pk>[^/.]+)/"
urlpatterns = [
    path(
        "messages/events/",
        DeliveryStatusWebhookView.as_view(),
        name="delivery-status-events",
    ),
    path(
        "webhooks/delivery-status/",
        DeliveryStatusWebhookView.as_view(),
        name="delivery-status-webhook",
    ),
    path(
        "provider/health/",
        ProviderHealthView.as_view(),
        name="provider-health",
    ),
    path(
        "provider/simulate-event/",
        SimulateDeliveryEventView.as_view(),
        name="provider-simulate-event",
    ),
    path(
        "candidates/<int:candidate_id>/messages/",
        CandidateMessagesView.as_view(),
        name="candidate-messages",
    ),
] + router.urls
