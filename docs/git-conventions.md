# AidFlow Git Conventions & Workflow

To maintain code hygiene, cross-team consistency, and predictable releases, all contributors to **AidFlow** follow these Git conventions.

---

## 1. Branching Strategy

We follow a modified GitHub Flow model centered around `main`:

| Branch Prefix | Format | Example | Purpose |
|---|---|---|---|
| `main` | `main` | `main` | Production-ready, stable codebase. Protected branch. |
| `feature/` | `feature/<scope>-<short-desc>` | `feature/client-leaflet-routing` | New functional features or UI components. |
| `fix/` | `fix/<scope>-<short-desc>` | `fix/server-token-expiration` | Bug fixes and patches. |
| `docs/` | `docs/<short-desc>` | `docs/update-api-contracts` | Documentation updates. |
| `chore/` | `chore/<short-desc>` | `chore/upgrade-vite` | Tooling, dependencies, or scaffolding adjustments. |

---

## 2. Commit Message Format (Conventional Commits)

All commits must follow the **Conventional Commits v1.0.0** specification:

```text
<type>(<scope>): <short imperative description>

[optional body providing technical context]

[optional footer(s), e.g. Closes #42]
```

### 2.1 Commit Types
- `feat`: A new user-facing or API feature.
- `fix`: A bug fix.
- `docs`: Documentation changes only.
- `test`: Adding or correcting tests.
- `refactor`: Code change that neither fixes a bug nor adds a feature.
- `chore`: Changes to build process, dependencies, or auxiliary tools.

### 2.2 Recognized Scopes
- `client`: React Vite client application.
- `server`: Express backend and Socket.IO server.
- `worker`: Zero-Redis background task runner.
- `shared`: Contracts, Zod schemas, state machines in `@aidflow/shared`.
- `auth`: Authentication and JWT guards.
- `dispatch`: Courier matching engine.

### 2.3 Examples
```text
feat(client): implement interactive assignment state machine visualizer
fix(server): prevent invalid state transition from DELIVERED to ACCEPTED
docs(shared): document 4 core roles and capability matrix
chore(root): configure npm workspaces for client, server, worker, and shared
```

---

## 3. Pull Request Guidelines

1. **Self-Contained**: Keep PRs focused on a single responsibility.
2. **Pre-flight Checks**: Before opening a PR, run:
   ```bash
   npm test
   ```
   Ensure tests pass across `@aidflow/shared`, `@aidflow/server`, `@aidflow/worker`, and `@aidflow/client`.
3. **Decoupled Verification**: Verify that the frontend continues to work with or without a live backend connection via mock mode.
