# AidFlow | Real-Time Surplus Food & Essential-Aid Coordination Platform

> 🏆 **Live Hackathon Judging Guide:** See [HACKATHON_DEMO.md](./HACKATHON_DEMO.md) for full setup instructions, demo credentials, architecture diagrams, the 10-scenario results checklist, and step-by-step judge walkthrough scripts!
>
> 🚀 **Run the 10-Scenario Automated Verification Suite:** `npm run test:scenarios`

AidFlow is a real-time humanitarian logistics platform connecting food donors (restaurants, bakeries, grocers) with emergency relief shelters, soup kitchens, and volunteer courier riders.

---

## 1. Architectural Overview & Monorepo Structure

AidFlow is structured as an npm workspaces monorepo using native **JavaScript ES modules** (`"type": "module"`). **TypeScript is deliberately not used**.

```text
aidflow/
├── apps/
│   ├── client/                  # React + Vite + Tailwind CSS + React Router + Leaflet
│   │   ├── src/
│   │   │   ├── components/      # MapPreview, StateMachineVisualizer, ContractsExplorer, Navbar
│   │   │   ├── services/        # api.js (with decoupled mock adapter), socket.js
│   │   │   └── pages/           # Dashboard.jsx
│   │   ├── vite.config.js
│   │   └── tailwind.config.js
│   │
│   ├── server/                  # Node.js + Express.js + Socket.IO + Mongoose + JWT
│   │   ├── src/
│   │   │   ├── config/          # Environment loader & resilient MongoDB connection
│   │   │   ├── middleware/      # responseFormat, validator (Zod), auth (JWT), errorHandler
│   │   │   ├── models/          # User, Donation, Shelter, Rider, Assignment, Reservation, Event, Job
│   │   │   ├── routes/          # /api/auth, /api/donations, /api/shelters, /api/riders, /api/dispatch, /api/assignments, /api/health
│   │   │   └── socket/          # Socket.IO room and dispatch event bus
│   │   └── src/index.js
│   │
│   └── worker/                  # Separate Node.js background worker (Zero Redis/BullMQ)
│       └── src/
│           ├── queue/           # JobQueue.js (MongoDB atomic lock polling engine)
│           ├── handlers/        # expirationChecker, dispatchOptimizer
│           └── index.js
│
├── packages/
│   └── shared/                  # Central source of truth for contracts, schemas & state machine
│       └── src/
│           ├── constants/       # Roles, AssignmentStates, EndpointPrefixes, ErrorCodes, SocketEvents
│           ├── schemas/         # Zod schemas for all domain entities
│           └── index.js
│
├── docs/                        # Engineering Specifications
│   ├── api-contracts.md         # Standard response/error envelope definitions & endpoints
│   ├── domain-models.md         # Entity schemas, fields, and constraints
│   ├── assignment-lifecycle.md  # State machine transition matrix & Mermaid diagram
│   ├── roles-and-permissions.md # Role definitions & capability matrix
│   ├── worker-architecture.md   # Zero-Redis MongoDB queue architecture
│   └── git-conventions.md       # Conventional Commits and PR guidelines
│
├── .env.example                 # Standardized environment template
├── .gitignore
├── package.json                 # Monorepo workspaces & unified npm scripts
└── README.md
```

---

## 2. Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, React Router v7, Leaflet + OpenStreetMap, Lucide Icons |
| **Backend** | Node.js (ESM), Express.js, Socket.IO, MongoDB + Mongoose, JWT, bcryptjs |
| **Data Validation** | Zod (Pure JS ES modules) |
| **Testing** | Vitest, Supertest |
| **Worker Queue** | Pure Node.js + MongoDB Atomic Lock Queue (**Zero Redis / Zero BullMQ**) |

---

## 3. Quickstart & Developer Setup

### 3.1 Prerequisites
- **Node.js**: v18.0.0 or higher (`node -v`)
- **npm**: v9.0.0 or higher (`npm -v`)
- **MongoDB** *(Optional for local dev)*: Runs seamlessly in decoupled mock mode if MongoDB is not active!

### 3.2 Installation
```bash
# Clone and install dependencies across all workspaces
npm install
```

### 3.3 Environment Setup
```bash
cp .env.example .env
```
Default ports configured:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- Worker: Background loop (no external port needed)

### 3.4 Running the Applications

#### Option A: Run Everything Concurrently
```bash
npm run dev
```

#### Option B: Run Services Individually
```bash
# Terminal 1 - Express Backend
npm run dev:server

# Terminal 2 - React Client
npm run dev:client

# Terminal 3 - Background Worker
npm run dev:worker
```

---

## 4. Independent Development Strategy (Decoupled Frontend & Backend)

AidFlow enables frontend and backend engineers to work concurrently without blocking each other:

1. **Shared Source of Truth (`@aidflow/shared`)**:
   Both apps import exact schemas and transition logic from the shared package.
2. **Client Mock Fallback**:
   The frontend `api.js` automatically detects if the backend is offline and seamlessly uses mock fixtures that match 100% of the API contract.
3. **Manual Mock Toggle**:
   The header contains an **"API Live / Mock Adapter"** toggle button allowing frontend developers to test both real and simulated network responses instantly.

---

## 5. Roles & Capabilities

AidFlow defines 4 core roles agreed across client and server:

| Role | Responsibility |
|---|---|
| **`ADMIN`** | Platform governance, dispatch oversight, fleet management, and audit inspection. |
| **`DONOR`** | Creates surplus food/aid listings, updates pickup slots, and tracks pickup progress. |
| **`RIDER`** | Receives dispatch offers, accepts routes, streams GPS coordinates, and confirms delivery handovers. |
| **`SHELTER_MANAGER`** | Manages shelter bed/meal capacity, urgency levels, and reserves incoming surplus donations. |

See [`docs/roles-and-permissions.md`](docs/roles-and-permissions.md) for the capability matrix.

---

## 6. Assignment State Machine & Transitions

The delivery lifecycle is strictly enforced by `canTransitionAssignment(current, next)`:

```text
UNASSIGNED ──► PENDING_ACCEPTANCE ──► ACCEPTED ──► PICKUP_IN_PROGRESS ──► PICKED_UP ──► DELIVERY_IN_PROGRESS ──► DELIVERED (Terminal)
    │                  │                  │                  │                  │                   │
    └──────────────────┴──────────────────┴──────────────────┴──────────────────┴───────────────────┴──► CANCELLED / FAILED (Terminal)
```

- Any attempt to bypass sequential transitions (e.g., jumping from `UNASSIGNED` to `DELIVERED`) is rejected with **HTTP 400 Bad Request** and error code `INVALID_STATE_TRANSITION`.
- See [`docs/assignment-lifecycle.md`](docs/assignment-lifecycle.md) for full matrix and Mermaid diagram.

---

## 7. Standard API Envelopes & Endpoint Prefixes

### Endpoint Prefixes
- `/api/auth` - Login, registration, JWT tokens, profile
- `/api/donations` - Create, browse, and reserve surplus donations
- `/api/shelters` - Shelter capacity, location, and urgency levels
- `/api/riders` - Fleet profiles, availability, and GPS telemetry
- `/api/dispatch` - Matchmaking recommendations and auto-assign
- `/api/assignments` - Assignment lifecycle and state transitions
- `/api/health` - Cluster health, database, and Socket.IO status

### Response Format
- **Success (`2xx`)**: `{ success: true, data: ..., message: ..., meta: ..., timestamp: ... }`
- **Error (`4xx / 5xx`)**: `{ success: false, error: { code: ..., message: ..., details: ... }, timestamp: ... }`

See [`docs/api-contracts.md`](docs/api-contracts.md) for payload examples.

---

## 8. Background Worker (Strict Zero-Redis Queue)

In compliance with the project constraint:
- **No Redis, No BullMQ**: The worker uses a MongoDB-backed atomic locking loop (`Job.findOneAndUpdate`).
- Stale locks from crashed instances are automatically recovered.
- Exponential backoff is applied on failures ($2^{\text{attempts}}$ seconds).
- Registered background jobs: `EXPIRATION_CHECKER` (checks near-expiry items) and `DISPATCH_OPTIMIZER` (matches donations to couriers).

See [`docs/worker-architecture.md`](docs/worker-architecture.md) for details.

---

## 9. Running Automated Tests

Run the full Vitest suite across all workspaces:
```bash
# Run all tests
npm test

# Or test individual workspaces
npm run test:shared
npm run test:server
npm run test:client
npm run test:worker
```

---

## 10. Git Conventions

AidFlow strictly follows **Conventional Commits**:
- `feat(scope): ...`
- `fix(scope): ...`
- `docs(scope): ...`
- `chore(scope): ...`

See [`docs/git-conventions.md`](docs/git-conventions.md) for full branching and PR guidelines.
