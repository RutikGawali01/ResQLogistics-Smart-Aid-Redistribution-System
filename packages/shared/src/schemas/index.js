import { z } from 'zod';
import { ALL_ROLES } from '../constants/roles.js';
import { ALL_ASSIGNMENT_STATUSES } from '../constants/assignmentStates.js';

/**
 * Geo-coordinates schema (Latitude [-90, 90], Longitude [-180, 180])
 */
export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

export const locationSchema = coordinatesSchema.extend({
  address: z.string().min(1, 'Address is required'),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional()
});

/**
 * Role Schema
 */
export const roleSchema = z.enum(ALL_ROLES);

/**
 * User & Auth Schemas
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: roleSchema.optional().default('DONOR'),
  phone: z.string().optional(),
  organization: z.string().optional()
});

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: roleSchema,
  phone: z.string().optional(),
  organization: z.string().optional(),
  active: z.boolean().default(true),
  createdAt: z.string().datetime().optional()
});

/**
 * Donation Categories & Storage Requirements
 */
export const DONATION_CATEGORIES = [
  'PERISHABLE',
  'NON_PERISHABLE',
  'PREPARED_MEALS',
  'BAKERY',
  'PRODUCE',
  'DAIRY',
  'BEVERAGES',
  'MEDICAL',
  'HYGIENE',
  'CLOTHING',
  'OTHER'
];

export const STORAGE_REQUIREMENTS = [
  'ROOM_TEMPERATURE',
  'REFRIGERATED',
  'FROZEN'
];

export const DONATION_STATUS = [
  'AVAILABLE',
  'RESERVED',
  'ASSIGNED',
  'IN_TRANSIT',
  'DELIVERED',
  'EXPIRED',
  'CANCELLED'
];

export const donationSchema = z.object({
  id: z.string().optional(),
  donorId: z.string().optional(),
  title: z.string().min(2, 'Title must be at least 2 characters').optional(),
  description: z.string().optional(),
  aidType: z.enum(DONATION_CATEGORIES).optional(),
  category: z.enum(DONATION_CATEGORIES).optional(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  availableQuantity: z.number().min(0).optional(),
  unit: z.string().min(1, 'Unit is required (e.g., kg, servings, boxes)'),
  storageRequirement: z.enum(STORAGE_REQUIREMENTS).default('ROOM_TEMPERATURE').optional(),
  handlingRequirements: z.string().optional(),
  safeUseDeadline: z.string().datetime().optional(),
  expirationDate: z.string().datetime().optional(),
  pickupLocation: locationSchema,
  status: z.enum(DONATION_STATUS).default('AVAILABLE'),
  allergens: z.array(z.string()).default([]).optional(),
  specialInstructions: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
}).refine(
  (data) => data.aidType || data.category,
  { message: 'Either aidType or category must be provided', path: ['aidType'] }
).refine(
  (data) => data.safeUseDeadline || data.expirationDate,
  { message: 'Either safeUseDeadline or expirationDate must be provided', path: ['safeUseDeadline'] }
);

export const donationUpdateSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  aidType: z.enum(DONATION_CATEGORIES).optional(),
  category: z.enum(DONATION_CATEGORIES).optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().min(1).optional(),
  handlingRequirements: z.string().optional(),
  storageRequirement: z.enum(STORAGE_REQUIREMENTS).optional(),
  safeUseDeadline: z.string().datetime().optional(),
  expirationDate: z.string().datetime().optional(),
  pickupLocation: locationSchema.optional(),
  status: z.enum(DONATION_STATUS).optional(),
  allergens: z.array(z.string()).optional(),
  specialInstructions: z.string().optional()
});

/**
 * Shelter Schema
 */
export const SHELTER_URGENCY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const shelterCapacitySchema = z.object({
  currentOccupancy: z.number().min(0).default(0),
  maxCapacity: z.number().positive(),
  mealsNeededPerDay: z.number().min(0).default(0)
});

export const shelterSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Shelter name is required'),
  managerId: z.string().optional(),
  address: z.string().min(5).optional(),
  location: z.union([locationSchema, coordinatesSchema]),
  currentDemand: z.number().min(0).default(0).optional(),
  receivingCapacity: z.number().min(0).optional(),
  availableResources: z.array(z.string()).default([]).optional(),
  isOpen: z.boolean().default(true).optional(),
  capacity: shelterCapacitySchema.optional(),
  urgencyLevel: z.enum(SHELTER_URGENCY).default('MEDIUM').optional(),
  acceptedCategories: z.array(z.enum(DONATION_CATEGORIES)).min(1).optional(),
  contactPhone: z.string().min(7).optional(),
  operatingHours: z.string().optional(),
  active: z.boolean().default(true).optional(),
  createdAt: z.string().datetime().optional()
});

export const shelterDemandSchema = z.object({
  currentDemand: z.number().min(0, 'Current demand must be non-negative').optional(),
  receivingCapacity: z.number().min(0, 'Receiving capacity must be non-negative').optional(),
  mealsNeededPerDay: z.number().min(0).optional()
}).refine(
  (data) => data.currentDemand !== undefined || data.receivingCapacity !== undefined || data.mealsNeededPerDay !== undefined,
  { message: 'Provide at least one demand or capacity field to update' }
);

export const shelterStatusSchema = z.object({
  isOpen: z.boolean().optional(),
  urgencyLevel: z.enum(SHELTER_URGENCY).optional()
}).refine(
  (data) => data.isOpen !== undefined || data.urgencyLevel !== undefined,
  { message: 'Provide isOpen or urgencyLevel to update' }
);

/**
 * Rider Schema
 */
export const VEHICLE_TYPES = ['BICYCLE', 'E_BIKE', 'MOTORCYCLE', 'CAR', 'VAN', 'TRUCK', 'WALKER'];
export const RIDER_STATUS = ['OFFLINE', 'AVAILABLE', 'ON_DISPATCH', 'BUSY'];

export const riderLocationSchema = coordinatesSchema.extend({
  address: z.string().optional(),
  heading: z.number().min(0).max(360).optional(),
  speedKmh: z.number().min(0).optional(),
  updatedAt: z.string().datetime().optional()
});

export const riderSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  name: z.string().min(2).optional(),
  phone: z.string().min(7).optional(),
  vehicleType: z.enum(VEHICLE_TYPES).default('E_BIKE').optional(),
  capacity: z.number().positive().optional(),
  maxCapacityKg: z.number().positive().optional(),
  availableCapacity: z.number().min(0).optional(),
  isAvailable: z.boolean().default(true).optional(),
  status: z.enum(RIDER_STATUS).default('OFFLINE').optional(),
  currentLocation: riderLocationSchema.optional(),
  activeAssignmentId: z.string().nullable().default(null).optional(),
  createdAt: z.string().datetime().optional()
});

export const riderAvailabilitySchema = z.object({
  isAvailable: z.boolean().optional(),
  status: z.enum(RIDER_STATUS).optional()
}).refine(
  (data) => data.isAvailable !== undefined || data.status !== undefined,
  { message: 'Provide isAvailable or status to update' }
);

export const riderCapacitySchema = z.object({
  capacity: z.number().positive('Capacity must be greater than zero').optional(),
  maxCapacityKg: z.number().positive('Capacity must be greater than zero').optional()
}).refine(
  (data) => data.capacity !== undefined || data.maxCapacityKg !== undefined,
  { message: 'Provide capacity or maxCapacityKg to update' }
);

/**
 * Assignment Schema
 */
export const assignmentTimelineSchema = z.object({
  assignedAt: z.string().datetime().optional(),
  acceptedAt: z.string().datetime().optional(),
  pickedUpAt: z.string().datetime().optional(),
  deliveredAt: z.string().datetime().optional(),
  cancelledAt: z.string().datetime().optional()
});

export const assignmentSchema = z.object({
  id: z.string().optional(),
  donationId: z.string().min(1, 'Donation ID is required'),
  shelterId: z.string().min(1, 'Shelter ID is required'),
  riderId: z.string().nullable().default(null).optional(),
  allocatedQuantity: z.number().positive('Allocated quantity must be greater than zero').optional(),
  status: z.enum(ALL_ASSIGNMENT_STATUSES).default('UNASSIGNED').optional(),
  deadline: z.string().datetime().optional(),
  pickupLocation: locationSchema.optional(),
  deliveryLocation: locationSchema.optional(),
  timeline: assignmentTimelineSchema.default({}).optional(),
  notes: z.string().optional(),
  cancellationReason: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});

export const assignmentTransitionSchema = z.object({
  targetStatus: z.enum(ALL_ASSIGNMENT_STATUSES),
  reason: z.string().optional(),
  coordinates: coordinatesSchema.optional()
});

/**
 * Reservation Schema
 */
export const RESERVATION_STATUS = ['REQUESTED', 'CONFIRMED', 'FULFILLED', 'CANCELLED', 'EXPIRED'];

export const reservationSchema = z.object({
  id: z.string().optional(),
  assignmentId: z.string().optional(),
  donationId: z.string().min(1, 'Donation ID is required'),
  shelterId: z.string().min(1, 'Shelter ID is required'),
  reservedByUserId: z.string().optional(),
  status: z.enum(RESERVATION_STATUS).default('REQUESTED').optional(),
  quantity: z.number().positive().optional(),
  requestedQuantity: z.number().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});

/**
 * Event / Audit Schema
 */
export const ENTITY_TYPES = ['DONATION', 'SHELTER', 'RIDER', 'ASSIGNMENT', 'RESERVATION', 'SYSTEM', 'USER'];

export const eventSchema = z.object({
  id: z.string().optional(),
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().min(1),
  eventType: z.string().min(1),
  actorId: z.string().optional(),
  actorRole: roleSchema.optional(),
  metadata: z.record(z.any()).default({}).optional(),
  payload: z.record(z.any()).default({}).optional(),
  createdAt: z.string().datetime().optional(),
  timestamp: z.string().datetime().optional()
});
