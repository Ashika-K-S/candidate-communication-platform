import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class DummyProviderHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def _send_json_response(self, status_code, data):
        payload = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Content-Length", "0")
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path in ["/", "/health", "/api/health"]:
            self._send_json_response(200, {
                "status": "ok",
                "service": "dummy-provider",
                "version": "2.0.0",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        else:
            self._send_json_response(404, {"error": "not_found", "message": "Endpoint not found"})

    def do_POST(self):
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

        # Endpoint 1: Send Message
        if self.path in ["/api/send", "/api/send/", "/send", "/send/"]:
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
            event_id = f"evt_{uuid.uuid4().hex[:12]}"
            return self._send_json_response(200, {
                "status": "sent",
                "provider_id": provider_id,
                "recipient": recipient,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "suggested_webhook_event": {
                    "event_id": event_id,
                    "provider_message_id": provider_id,
                    "status": "delivered",
                },
            })

        # Endpoint 2: Simulate Delivery Status Callback / Webhook trigger
        if self.path in ["/api/simulate-event", "/api/simulate-event/", "/api/webhook/simulate", "/api/webhook/simulate/"]:
            backend_url = data.get("backend_url", "http://127.0.0.1:8000/api/messages/events/")
            provider_message_id = data.get("provider_message_id")
            message_id = data.get("message_id")
            event_status = data.get("status", "delivered")
            event_id = data.get("event_id") or f"evt_sim_{uuid.uuid4().hex[:10]}"
            failure_reason = data.get("failure_reason")

            if not provider_message_id and not message_id:
                return self._send_json_response(400, {
                    "error": "missing_identifier",
                    "message": "Either 'provider_message_id' or 'message_id' is required to simulate a delivery event."
                })

            event_payload = {
                "event_id": event_id,
                "status": event_status,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            if provider_message_id:
                event_payload["provider_message_id"] = provider_message_id
            if message_id:
                event_payload["message_id"] = message_id
            if failure_reason:
                event_payload["failure_reason"] = failure_reason

            # Dispatch HTTP POST to the backend
            try:
                req_data = json.dumps(event_payload).encode("utf-8")
                req = urllib.request.Request(
                    backend_url,
                    data=req_data,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=5.0) as resp:
                    resp_body = resp.read().decode("utf-8")
                    try:
                        resp_json = json.loads(resp_body)
                    except Exception:
                        resp_json = {"raw": resp_body}
                    return self._send_json_response(200, {
                        "simulated_event": event_payload,
                        "backend_status_code": resp.status,
                        "backend_response": resp_json,
                    })
            except urllib.error.HTTPError as he:
                err_body = he.read().decode("utf-8")
                try:
                    err_json = json.loads(err_body)
                except Exception:
                    err_json = {"raw": err_body}
                return self._send_json_response(200, {
                    "simulated_event": event_payload,
                    "backend_status_code": he.code,
                    "backend_response": err_json,
                })
            except Exception as e:
                return self._send_json_response(502, {
                    "error": "backend_dispatch_failed",
                    "message": f"Could not reach backend at {backend_url}: {str(e)}",
                    "simulated_event": event_payload,
                })

        self._send_json_response(404, {"error": "not_found", "message": "Endpoint not found"})

    def log_message(self, format, *args):
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
    if len(sys.argv) > 1 and sys.argv[1] == "simulate":
        # CLI convenience: python server.py simulate <provider_message_id> <status> [event_id]
        pm_id = sys.argv[2] if len(sys.argv) > 2 else "prov_msg_test"
        st = sys.argv[3] if len(sys.argv) > 3 else "delivered"
        eid = sys.argv[4] if len(sys.argv) > 4 else f"evt_cli_{uuid.uuid4().hex[:8]}"
        payload = json.dumps({"event_id": eid, "provider_message_id": pm_id, "status": st}).encode("utf-8")
        req = urllib.request.Request(
            "http://127.0.0.1:8000/api/messages/events/",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                print("Response:", r.status, r.read().decode("utf-8"))
        except Exception as ex:
            print("Error simulating event:", ex)
    else:
        host_arg = sys.argv[1] if len(sys.argv) > 1 else None
        port_arg = int(sys.argv[2]) if len(sys.argv) > 2 else None
        run(host_arg, port_arg)
