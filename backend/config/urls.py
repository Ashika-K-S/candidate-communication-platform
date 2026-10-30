"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.urls import include, path


def health_check(request):
    """
    Lightweight, safe health check endpoint for deployment platforms (e.g. Render)
    and browser root verification without exposing sensitive environment details.
    """
    return JsonResponse(
        {
            "status": "healthy",
            "service": "talentreach-backend",
        },
        status=200,
    )


urlpatterns = [
    path("", health_check, name="root-health"),
    path("favicon.ico", lambda r: HttpResponse(status=204), name="favicon"),
    path("api/health/", health_check, name="api-health"),
    path("admin/", admin.site.urls),
    path("api/", include("candidates.urls")),
    path("api/", include("messaging.urls")),
]
