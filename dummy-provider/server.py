import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class DummyProviderHandler(BaseHTTPRequestHandler):
    def _send_json_response(self, status_code, data):
        payload = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path in ["/", "/health", "/api/health"]:
            self._send_json_response(200, {
                "status": "ok",
                "service": "dummy-provider",
                "version": "1.0.0",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        else:
            self._send_json_response(404, {"error": "not_found", "message": "Endpoint not found"})

    def do_POST(self):
        if self.path in ["/api/send", "/api/send/", "/send", "/send/"]:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                return self._send_json_response(400, {
                    "status": "failed",
                    "error": "empty_request",
                    "message": "Request body cannot be empty."
                })

            try:
                body = self.rfile.read(content_length)
                data = json.loads(body.decode("utf-8"))
            except Exception as e:
                return self._send_json_response(400, {
                    "status": "failed",
                    "error": "malformed_json",
                    "message": f"Invalid JSON payload: {str(e)}"
                })

            recipient = str(data.get("recipient", "")).strip()
            content = str(data.get("content", "")).strip()

            if not recipient or not content:
                return self._send_json_response(400, {
                    "status": "failed",
                    "error": "validation_error",
                    "message": "Both 'recipient' and 'content' are required and cannot be empty."
                })

            # Check for simulated timeout
            if "timeout" in recipient.lower() or recipient.endswith("0000") or "[timeout]" in content:
                time.sleep(12)
                return self._send_json_response(504, {
                    "status": "failed",
                    "error": "gateway_timeout",
                    "message": "Provider timed out processing the message."
                })

            # Check for simulated permanent failure
            if (
                "perm_fail" in recipient.lower()
                or "blocked" in recipient.lower()
                or recipient.endswith("9999")
                or "[perm_fail]" in content
            ):
                return self._send_json_response(422, {
                    "status": "failed",
                    "error": "permanent_failure",
                    "message": "Recipient number is invalid, blocked, or unreachable (permanent failure)."
                })

            # Check for simulated temporary failure
            if (
                "temp_fail" in recipient.lower()
                or recipient.endswith("5030")
                or "[temp_fail]" in content
            ):
                return self._send_json_response(503, {
                    "status": "failed",
                    "error": "temporary_failure",
                    "message": "Downstream carrier network congested (temporary failure). Please retry later."
                })

            # Default: Success
            provider_id = f"prov_msg_{uuid.uuid4().hex[:12]}"
            return self._send_json_response(200, {
                "status": "sent",
                "provider_id": provider_id,
                "recipient": recipient,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        self._send_json_response(404, {"error": "not_found", "message": "Endpoint not found"})

    def log_message(self, format, *args):
        # Override to provide clean standard logging to stderr
        sys.stderr.write(f"[dummy-provider] {self.address_string()} - {format % args}\n")


def run(host=None, port=None):
    host = host or os.getenv("DUMMY_PROVIDER_HOST", "127.0.0.1")
    port = int(port or os.getenv("DUMMY_PROVIDER_PORT", "8001"))
    server_address = (host, port)
    httpd = ThreadingHTTPServer(server_address, DummyProviderHandler)
    print(f"Dummy Communication Provider running on http://{host}:{port}/")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down dummy communication provider.")
        httpd.server_close()


if __name__ == "__main__":
    host_arg = sys.argv[1] if len(sys.argv) > 1 else None
    port_arg = int(sys.argv[2]) if len(sys.argv) > 2 else None
    run(host_arg, port_arg)
