# TalentReach — Candidate Communication Platform

A full-stack recruitment communication platform that enables recruiters to manage candidates, send individual and bulk messages, monitor delivery statuses, handle communication failures, and maintain candidate communication histories.

## Live Demo

* **Frontend:** https://talentreach.vercel.app
* **Backend API:** https://talentreach-backend.onrender.com
* **GitHub Repository:** https://github.com/Ashika-K-S/candidate-communication-platform

> Note: The backend is hosted on Render. Initial requests may take longer if the service has been inactive.

## Overview

TalentReach is designed to simplify candidate communication throughout the recruitment process. Recruiters can manage candidate records, send messages individually or in bulk, and monitor message delivery through a centralized dashboard.

The application uses a separate dummy communication provider to simulate communication delivery and provider failures without requiring a paid third-party messaging service.

## Features

### Candidate Management

* Create and manage candidate records.
* View the candidate list.
* Search for candidates.
* View individual candidate details.

### Individual Messaging

* Send messages to individual candidates.
* Track message status.
* Maintain communication records.

### Bulk Messaging

* Send a common message to multiple selected candidates.
* Process each candidate's message independently.
* Track individual outcomes for bulk messages.
* Report successful and failed message attempts.

### Message Tracking

* Monitor message delivery statuses.
* View message records and candidate communication history.
* Record delivery status events.
* Prevent duplicate status events from incorrectly changing message state.

### Failure Handling and Retry

* Handle communication provider errors.
* Distinguish between temporary and permanent failures where supported.
* Retry eligible failed messages.
* Record retry attempts for auditing.

### Provider Health Monitoring

* Display communication provider availability.
* Check connectivity with the provider service.
* Report provider health and response latency.

### Dashboard

* View total candidates and messages.
* Monitor delivered and failed message counts.
* Check communication provider status.
* Access individual messaging and bulk campaign workflows.

## Technology Stack

| Layer                   | Technologies                          |
| ----------------------- | ------------------------------------- |
| Frontend                | Next.js, React, TypeScript            |
| Styling                 | Tailwind CSS                          |
| Backend                 | Python, Django, Django REST Framework |
| Database                | PostgreSQL                            |
| Communication           | Standalone HTTP REST dummy provider   |
| Frontend Hosting        | Vercel                                |
| Backend Hosting         | Render                                |
| Version Control         | Git and GitHub                        |
| Development Environment | Visual Studio Code                    |

## Architecture

The application separates the frontend, backend, database, and communication provider into distinct components.

```text
                 Recruiter
                     |
                     v
          Next.js Frontend
             (Vercel)
                     |
                REST API
                     |
                     v
           Django REST API
              (Render)
               /       \
              v         v
      PostgreSQL     Dummy Provider
       Database      HTTP Service
                         |
                         v
                Simulated Delivery
                  Status Events
                         |
                         v
                 Django Backend
                         |
                         v
                Updated Message Status
```

### Component Responsibilities

**Frontend**

* Provides the recruiter dashboard and messaging interface.
* Displays candidate records, message counts, provider status, and delivery outcomes.
* Communicates with the backend through REST APIs.

**Backend**

* Handles candidate management and messaging operations.
* Coordinates communication with the provider.
* Maintains message records and delivery statuses.
* Processes delivery events and retry requests.

**Database**

* Stores candidate information, messages, delivery status events, and retry records.

**Dummy Communication Provider**

* Operates as a separate HTTP service.
* Simulates message submission and delivery behavior.
* Supports testing of successful and failed communication scenarios.
* Allows provider-related failure handling to be tested without depending on a paid messaging provider.

## API Overview

The backend exposes REST endpoints for candidate management, messaging, delivery events, retries, and provider health monitoring.

### Candidate Management

| Method      | Endpoint                | Description                |
| ----------- | ----------------------- | -------------------------- |
| GET         | `/api/candidates/`      | List and search candidates |
| POST        | `/api/candidates/`      | Create a candidate         |
| GET         | `/api/candidates/<id>/` | Retrieve candidate details |
| PUT / PATCH | `/api/candidates/<id>/` | Update a candidate         |
| DELETE      | `/api/candidates/<id>/` | Delete a candidate         |

### Messaging

| Method | Endpoint                         | Description                                  |
| ------ | -------------------------------- | -------------------------------------------- |
| POST   | `/api/messages/send/`            | Send an individual message                   |
| POST   | `/api/messages/bulk-send/`       | Send messages to multiple candidates         |
| GET    | `/api/messages/`                 | List messages                                |
| GET    | `/api/messages/<id>/`            | Retrieve message details                     |
| GET    | `/api/candidates/<id>/messages/` | Retrieve a candidate's communication history |
| POST   | `/api/messages/<id>/retry/`      | Retry an eligible failed message             |

### Delivery Events and Provider Health

| Method | Endpoint                         | Description                          |
| ------ | -------------------------------- | ------------------------------------ |
| POST   | `/api/messages/events/`          | Process message status events        |
| POST   | `/api/webhooks/delivery-status/` | Delivery status webhook endpoint     |
| GET    | `/api/provider/health/`          | Check provider health                |
| GET    | `/api/messages/provider-health/` | Alternative provider health endpoint |

All endpoints use the deployed backend base URL in production.

## Local Setup

### Prerequisites

Install the following before running the project:

* Python compatible with the backend dependencies
* Node.js and npm
* PostgreSQL
* Git
* Visual Studio Code

### 1. Clone the Repository

Open the terminal in Visual Studio Code and run:

```bash
git clone https://github.com/Ashika-K-S/candidate-communication-platform.git
cd candidate-communication-platform
```

### 2. Configure PostgreSQL

Start PostgreSQL and create a database named `candidate_platform`.

```sql
CREATE DATABASE candidate_platform;
```

### 3. Configure the Backend

Open a terminal in the project root.

Create a Python virtual environment:

```bash
python -m venv backend/.venv
```

Activate it in Windows PowerShell:

```powershell
.\backend\.venv\Scripts\Activate.ps1
```

Install the backend dependencies:

```bash
pip install -r backend/requirements.txt
```

Create a local backend environment file by copying the example:

```powershell
Copy-Item backend/.env.example backend/.env
```

Update `backend/.env` with your local database credentials and development settings.

The configuration includes:

* Django secret key and debug settings
* Allowed hosts
* PostgreSQL connection settings
* Communication provider URL and timeout
* Frontend URL for CORS configuration

Keep secret keys and database passwords private. Do not commit `.env` files.

### 4. Run Database Migrations

From the project root:

```bash
python backend/manage.py migrate
```

Run the Django system check:

```bash
python backend/manage.py check
```

### 5. Start the Backend

```bash
python backend/manage.py runserver 127.0.0.1:8000
```

The backend API will be available at:

`http://127.0.0.1:8000`

### 6. Start the Dummy Provider

Open a second terminal in Visual Studio Code and run:

```bash
python dummy-provider/server.py 127.0.0.1 8001
```

The backend should be configured to use:

`http://127.0.0.1:8001`

Keep the provider running while testing messaging functionality locally.

### 7. Configure and Start the Frontend

Open a third terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env.local` using `frontend/.env.example` as a reference.

For local development, configure the frontend to use the local backend API:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
```

Start the frontend:

```bash
npm run dev
```

Open:

`http://localhost:3000`

For production, the frontend must use the deployed backend URL rather than the local development URL.

## Testing

### Backend Tests

From the project root, activate the backend virtual environment and run:

```bash
python backend/manage.py test candidates messaging
```

### Frontend Tests

From the frontend directory:

```bash
npm test
```

### Frontend Linting

```bash
npm run lint
```

### Production Build

```bash
npm run build
```

## Deployment

The application is deployed using separate frontend and backend hosting services.

### Frontend — Vercel

The Next.js frontend is deployed on Vercel and communicates with the production backend API.

### Backend — Render

The Django REST API is deployed on Render and connects to the configured PostgreSQL database.

### Communication Provider

The dummy provider simulates communication behavior for development and testing. It is not a real WhatsApp, SMS, or email delivery service.

## Important Notes

* The dummy provider is intended for testing communication workflows.
* Real-world messaging requires integration with an appropriate external provider.
* Environment variables must be configured separately for local development and production.
* Provider availability depends on the provider process being reachable.
* Delivery statuses in the dummy-provider environment represent simulated delivery behavior.

## Author

**Ashika K S**

GitHub: https://github.com/Ashika-K-S
