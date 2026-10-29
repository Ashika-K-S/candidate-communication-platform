# Dummy Communication Provider Service

A lightweight, standalone HTTP service that simulates a third-party SMS/messaging gateway for the Candidate Communication Platform.

## Features
- Independently runnable from Django.
- Communicates purely over standard HTTP REST.
- Multi-threaded request processing.
- Supports deterministic simulation of success and failure scenarios based on recipient number/content:
  - **Success (HTTP 200)**: Returns `{"status": "sent", "provider_id": "prov_msg_..."}`.
  - **Permanent Failure (HTTP 422)**: Triggered when recipient contains `perm_fail`, `blocked`, ends with `9999`, or content includes `[perm_fail]`.
  - **Temporary Failure (HTTP 503)**: Triggered when recipient contains `temp_fail`, ends with `5030`, or content includes `[temp_fail]`.
  - **Timeout Simulation**: Triggered when recipient contains `timeout`, ends with `0000`, or content includes `[timeout]`.

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
