# AidFlow API Contracts Specification

This document defines the shared API response standards, error structures, and endpoint prefix conventions for the **AidFlow** platform.

All client, server, and worker components adhere strictly to these contracts.

---

## 1. Endpoint Prefixes

All routes are mounted under consistent `/api` prefixes:

| Domain | Prefix | Purpose |
|---|---|---|
| **Health** | `/api/health` | Service health, DB connection status, Socket.IO telemetry |
| **Authentication** | `/api/auth` | User registration, login, JWT issuance, profile retrieval (`/me`) |
| **Donations** | `/api/donations` | Surplus food & goods creation, listing, radius search, reservations |
| **Shelters** | `/api/shelters` | Relief shelter profiles, capacity levels, and food supply urgency |
| **Riders** | `/api/riders` | Courier fleet profiles, status updates, and GPS location updates |
| **Dispatch** | `/api/dispatch` | Courier-to-shelter matching engine, recommendation calculations |
| **Assignments** | `/api/assignments` | Delivery assignment lifecycle management and state transitions |

---

## 2. Standard Response Envelope

Every API response returns a standardized JSON structure. Client applications never need to guess the payload shape.

### 2.1 Success Response Envelope (`HTTP 200 / 201`)

```json
{
  "success": true,
  "data": {
    "id": "asg_98231",
    "status": "ACCEPTED",
    "timeline": {
      "assignedAt": "2026-10-23T06:55:00.000Z",
      "acceptedAt": "2026-10-23T07:00:00.000Z"
    }
  },
  "message": "Assignment accepted successfully",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  },
  "timestamp": "2026-10-23T07:00:01.120Z"
}
```

- `success` (`boolean`): Always `true` for 2xx responses.
- `data` (`any`): The payload object, array, or scalar.
- `message` (`string | null`): Human-readable operational message.
- `meta` (`object | null`): Pagination, telemetry, or auxiliary context.
- `timestamp` (`string`): ISO 8601 UTC timestamp.

### 2.2 Error Response Envelope (`HTTP 4xx / 5xx`)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Invalid transition from \"UNASSIGNED\" to \"DELIVERED\". Permitted next states: [PENDING_ACCEPTANCE, CANCELLED]",
    "details": {
      "currentStatus": "UNASSIGNED",
      "attemptedStatus": "DELIVERED"
    }
  },
  "timestamp": "2026-10-23T07:00:01.120Z"
}
```

- `success` (`boolean`): Always `false` for non-2xx responses.
- `error.code` (`string`): Programmatic error code from `ERROR_CODES`.
- `error.message` (`string`): Human-readable error description.
- `error.details` (`any`): Contextual details (e.g. Zod field errors or permitted transition lists).
- `timestamp` (`string`): ISO 8601 UTC timestamp.

---

## 3. Standard Error Codes

Defined centrally in `@aidflow/shared`:

| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 422 Unprocessable Entity | Request body or query params failed Zod schema parsing |
| `UNAUTHORIZED` | 401 Unauthorized | Missing, invalid, or expired Bearer JWT |
| `FORBIDDEN` | 403 Forbidden | User role lacks required capability |
| `NOT_FOUND` | 404 Not Found | Requested entity ID does not exist |
| `CONFLICT` | 409 Conflict | Duplicate unique key (e.g., existing email) or invalid concurrent state |
| `INVALID_STATE_TRANSITION` | 400 Bad Request | Attempted illegal jump in the Assignment state machine |
| `BAD_REQUEST` | 400 Bad Request | Malformed request parameters |
| `INTERNAL_SERVER_ERROR` | 500 Internal Error | Unhandled server exception |
| `SERVICE_UNAVAILABLE` | 503 Service Unavailable | Dependent service offline |

---

## 4. Frontend Decoupling Strategy

Frontend engineers can toggle between two modes using `api.js`:
1. **Live Mode**: Calls Express endpoints on `http://localhost:5000/api` (proxied by Vite).
2. **Mock Mode (Decoupled)**: Returns local mock fixtures adhering 100% to the exact same contract envelopes above. If the backend is offline, the client automatically defaults to mock mode without crashing.
