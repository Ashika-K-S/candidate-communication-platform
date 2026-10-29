# Dummy Communication Provider Service

A lightweight, standalone HTTP service that simulates a third-party SMS/messaging gateway for the Candidate Communication Platform.

## Features
- Independently runnable from Django.
- Communicates purely over standard HTTP REST.
- Multi-threaded request processing with zero external dependencies.
- Deterministic simulation of success and failure scenarios based on recipient number/content:
  - **Success (HTTP 200)**: Returns `{"status": "sent", "provider_id": "prov_msg_..."}`.
  - **Permanent Failure (HTTP 422)**: Triggered when recipient contains `perm_fail`, `blocked`, ends with `9999`, or content includes `[perm_fail]`.
  - **Temporary Failure (HTTP 503)**: Triggered when recipient contains `temp_fail`, ends with `5030`, or content includes `[temp_fail]`.
  - **Timeout Simulation (HTTP 504)**: Triggered when recipient contains `timeout`, ends with `0000`, or content includes `[timeout]` (delays 12 seconds).
- **Delivery Event Simulation**: Allows triggering outbound webhook/callback events directly to the Django backend to test delivery lifecycle, idempotency, and state transitions.

## Running the Service

```bash
# From the project root:
python dummy-provider/server.py

# Or specify custom host and port:
python dummy-provider/server.py 127.0.0.1 8001
```

## API Endpoints

### 1. Health Check
- **Method**: `GET`
- **Path**: `/health`
- **Response**: `200 OK`
  ```json
  {
    "status": "ok",
    "service": "dummy-provider",
    "version": "2.0.0",
    "timestamp": "2026-10-29T21:00:00Z"
  }
  ```

### 2. Send Message
- **Method**: `POST`
- **Path**: `/api/send/`
- **Body**:
  ```json
  {
    "recipient": "+15551234567",
    "content": "Hello, interview scheduled!"
  }
  ```

### 3. Simulate Delivery Status Event
Trigger a delivery-status callback to the Django backend:
- **Method**: `POST`
- **Path**: `/api/simulate-event/`
- **Body**:
  ```json
  {
    "backend_url": "http://127.0.0.1:8000/api/messages/events/",
    "provider_message_id": "prov_msg_12345",
    "status": "delivered",
    "event_id": "evt_test_001"
  }
  ```

### 4. CLI Simulation Shortcut
You can also trigger a delivery event from the command line:
```bash
python dummy-provider/server.py simulate prov_msg_12345 delivered evt_001
```
