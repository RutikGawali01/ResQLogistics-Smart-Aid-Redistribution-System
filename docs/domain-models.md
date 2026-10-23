# AidFlow Core Domain Models

This document specifies the primary entities governing the AidFlow coordination system. All models are defined in Mongoose (`apps/server/src/models/`) and mirrored as Zod schemas (`packages/shared/src/schemas/index.js`).

---

## 1. Donation

Represents surplus food, medical items, or essential aid offered by donors (restaurants, supermarkets, caterers, relief funds).

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | ObjectId / String | Yes | Unique donation identifier |
| `donorId` | Ref(User) | Yes | Account that posted the donation |
| `title` | String | Yes | Item title (e.g., "50 Servings Prepared Vegetarian Curry") |
| `description` | String | No | Detailed description, packaging, or handling notes |
| `category` | Enum | Yes | `PERISHABLE`, `NON_PERISHABLE`, `PREPARED_MEALS`, `BAKERY`, `PRODUCE`, `DAIRY`, `BEVERAGES`, `MEDICAL`, `HYGIENE`, `CLOTHING`, `OTHER` |
| `quantity` | Number | Yes | Numeric quantity (> 0) |
| `unit` | String | Yes | Unit of measure (`kg`, `servings`, `boxes`, `pallets`) |
| `storageRequirement` | Enum | Yes | `ROOM_TEMPERATURE`, `REFRIGERATED`, `FROZEN` |
| `expirationDate` | Date / ISO8601 | Yes | Hard expiry or safe consumption deadline |
| `pickupLocation` | Object | Yes | `{ address, city, latitude, longitude, contactName, contactPhone }` |
| `status` | Enum | Yes | `AVAILABLE`, `RESERVED`, `ASSIGNED`, `IN_TRANSIT`, `DELIVERED`, `EXPIRED`, `CANCELLED` |
| `allergens` | String[] | No | Allergen tags (e.g. `['Gluten', 'Nuts', 'Dairy']`) |
| `specialInstructions` | String | No | Loading dock info, entry codes, or pickup hours |

---

## 2. Shelter

Represents shelters, soup kitchens, community pantries, and disaster relief hubs receiving donations.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | ObjectId / String | Yes | Unique shelter identifier |
| `name` | String | Yes | Name of the facility |
| `managerId` | Ref(User) | Yes | Assigned shelter manager |
| `address` | String | Yes | Full physical address |
| `location` | Object | Yes | Coordinates: `{ latitude: Number, longitude: Number }` |
| `capacity` | Object | Yes | `{ currentOccupancy: Number, maxCapacity: Number, mealsNeededPerDay: Number }` |
| `urgencyLevel` | Enum | Yes | Priority level: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `acceptedCategories` | Enum[] | Yes | Array of acceptable donation categories |
| `contactPhone` | String | Yes | Emergency contact phone number |
| `operatingHours` | String | No | e.g. "24/7" or "08:00 - 22:00" |
| `active` | Boolean | Yes | Operational availability status |

---

## 3. Rider

Represents volunteer couriers or logistics drivers transporting aid items from donors to shelters.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | ObjectId / String | Yes | Unique rider identifier |
| `userId` | Ref(User) | Yes | Account reference |
| `name` | String | Yes | Full name |
| `phone` | String | Yes | Contact number |
| `vehicleType` | Enum | Yes | `BICYCLE`, `E_BIKE`, `MOTORCYCLE`, `CAR`, `VAN`, `TRUCK`, `WALKER` |
| `maxCapacityKg` | Number | Yes | Cargo weight limit in kilograms |
| `status` | Enum | Yes | `OFFLINE`, `AVAILABLE`, `ON_DISPATCH`, `BUSY` |
| `currentLocation` | Object | No | `{ latitude, longitude, heading, speedKmh, updatedAt }` |
| `activeAssignmentId` | Ref(Assignment) | No | Currently active dispatch assignment |

---

## 4. Assignment

Represents the physical transport dispatch linking a donation to a receiving shelter via an assigned rider.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | ObjectId / String | Yes | Unique assignment identifier |
| `donationId` | Ref(Donation) | Yes | Associated donation |
| `shelterId` | Ref(Shelter) | Yes | Destination shelter |
| `riderId` | Ref(Rider) | No | Assigned courier (null if unassigned) |
| `status` | Enum | Yes | Governed by the **Assignment State Machine** |
| `pickupLocation` | Object | Yes | Pickup address & geo-coordinates |
| `deliveryLocation` | Object | Yes | Drop-off address & geo-coordinates |
| `timeline` | Object | Yes | `{ assignedAt, acceptedAt, pickedUpAt, deliveredAt, cancelledAt }` |
| `notes` | String | No | Transit or special handling instructions |
| `cancellationReason` | String | No | Documented explanation if cancelled |

---

## 5. Reservation

Represents a temporary claim made by a shelter manager on available surplus items before courier dispatch is confirmed.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | ObjectId / String | Yes | Unique reservation identifier |
| `donationId` | Ref(Donation) | Yes | Donation being held |
| `shelterId` | Ref(Shelter) | Yes | Reserving shelter |
| `reservedByUserId` | Ref(User) | Yes | Shelter manager user ID |
| `status` | Enum | Yes | `REQUESTED`, `CONFIRMED`, `FULFILLED`, `CANCELLED`, `EXPIRED` |
| `requestedQuantity`| Number | Yes | Reserved amount |
| `expiresAt` | Date | Yes | Hold expiration deadline (e.g. 3 hours after claim) |

---

## 6. Event

Audit ledger capturing domain occurrences for real-time Socket.IO broadcasts and compliance reporting.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | ObjectId / String | Yes | Unique event ID |
| `entityType` | Enum | Yes | `DONATION`, `SHELTER`, `RIDER`, `ASSIGNMENT`, `RESERVATION`, `SYSTEM` |
| `entityId` | String | Yes | ID of the affected resource |
| `eventType` | String | Yes | Event name (e.g., `ASSIGNMENT_ACCEPTED`, `RIDER_LOCATION_UPDATE`) |
| `actorId` | Ref(User) | No | User initiating the action |
| `actorRole` | Enum | No | Role of actor (`ADMIN`, `DONOR`, `RIDER`, `SHELTER_MANAGER`) |
| `payload` | Object | Yes | Event context metadata |
| `timestamp` | Date | Yes | Event creation timestamp |
