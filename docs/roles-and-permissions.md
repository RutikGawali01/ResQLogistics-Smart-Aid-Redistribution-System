# AidFlow Roles & Permissions Matrix

This document defines the 4 core stakeholder roles agreed upon for the AidFlow platform, including access permissions and functional boundaries.

---

## 1. System Roles Overview

| Role | Label | Target Users |
|---|---|---|
| `ADMIN` | Platform Administrator | System operators, dispatch coordinators, trust & safety managers |
| `DONOR` | Aid & Food Donor | Restaurants, bakeries, corporate cafeterias, grocers, food drives |
| `RIDER` | Volunteer / Courier Rider | Couriers, cyclists, licensed drivers delivering goods |
| `SHELTER_MANAGER` | Shelter / Relief Hub Manager | Operators of homeless shelters, soup kitchens, emergency camps |

---

## 2. Capabilities & Access Matrix

| Capability | ADMIN | DONOR | RIDER | SHELTER_MANAGER |
|---|:---:|:---:|:---:|:---:|
| **Create Surplus Donation** | ✅ | ✅ | ❌ | ❌ |
| **Manage / Cancel Own Donations** | ✅ | ✅ | ❌ | ❌ |
| **View City-Wide Surplus Feed** | ✅ | ❌ | ❌ | ✅ |
| **Reserve Surplus Aid** | ✅ | ❌ | ❌ | ✅ |
| **Update Shelter Capacity & Urgency** | ✅ | ❌ | ❌ | ✅ |
| **Accept Dispatch Assignment** | ✅ | ❌ | ✅ | ❌ |
| **Update Transit States (Pickup / Deliver)** | ✅ | ❌ | ✅ | ❌ |
| **Broadcast Live GPS Telemetry** | ✅ | ❌ | ✅ | ❌ |
| **Force Re-assign / Override Dispatch** | ✅ | ❌ | ❌ | ❌ |
| **System Health & Audit Logs** | ✅ | ❌ | ❌ | ❌ |

---

## 3. Role Verification in Code

### 3.1 Token Claims
When an authenticated user logs in via `/api/auth/login`, their JWT contains:
```json
{
  "id": "usr_789123",
  "email": "manager@downtownrefuge.org",
  "role": "SHELTER_MANAGER",
  "name": "Sarah Chen"
}
```

### 3.2 Express Route Protection
Role guards are applied via middleware:
```javascript
import { authenticate, requireRoles } from '../middleware/auth.js';
import { ROLES } from '@aidflow/shared';

// Protected endpoint: Shelter managers and admins only
router.patch(
  '/shelters/:id/capacity',
  authenticate,
  requireRoles(ROLES.SHELTER_MANAGER, ROLES.ADMIN),
  updateCapacityHandler
);
```
Violations return **HTTP 403 Forbidden** with `error.code: "FORBIDDEN"`.
