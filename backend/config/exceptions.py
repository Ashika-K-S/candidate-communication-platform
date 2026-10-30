import logging
from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Standardized REST Framework exception handler.
    Ensures safe, structured JSON responses without leaking internal server details or credentials.
    """
    # Call DRF's default exception handler first to get the standard response
    response = exception_handler(exc, context)

    if response is not None:
        # Standardize 404 responses
        if response.status_code == status.HTTP_404_NOT_FOUND:
            if not isinstance(response.data, dict) or "detail" not in response.data:
                response.data = {"detail": str(response.data.get("detail", "Resource not found."))}
        return response

    # Handle standard Django exceptions not caught by DRF
    if isinstance(exc, Http404):
        return Response({"detail": "Resource not found."}, status=status.HTTP_404_NOT_FOUND)

    if isinstance(exc, PermissionDenied):
        return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

    # Catch-all for unexpected 500 server errors
    view_name = context.get("view").__class__.__name__ if context and "view" in context else "UnknownView"
    logger.exception("Unhandled server exception in view %s: %s", view_name, str(exc))

    return Response(
        {
            "error": "server_error",
            "detail": "An unexpected internal server error occurred. Please try again later.",
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
