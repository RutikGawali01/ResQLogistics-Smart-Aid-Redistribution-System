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
  donorId: z.string().min(1, 'Donor ID is required'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  category: z.enum(DONATION_CATEGORIES),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unit: z.string().min(1, 'Unit is required (e.g., kg, servings, boxes)'),
  storageRequirement: z.enum(STORAGE_REQUIREMENTS).default('ROOM_TEMPERATURE'),
  expirationDate: z.string().datetime(),
  pickupLocation: locationSchema,
  status: z.enum(DONATION_STATUS).default('AVAILABLE'),
  allergens: z.array(z.string()).default([]),
  specialInstructions: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});

/**
 * Shelter Schema
 */
export const SHELTER_URGENCY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const shelterCapacitySchema = z.object({
  currentOccupancy: z.number().min(0),
  maxCapacity: z.number().positive(),
  mealsNeededPerDay: z.number().min(0).default(0)
});

export const shelterSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Shelter name is required'),
  managerId: z.string().min(1, 'Manager ID is required'),
  address: z.string().min(5, 'Full address is required'),
  location: coordinatesSchema,
  capacity: shelterCapacitySchema,
  urgencyLevel: z.enum(SHELTER_URGENCY).default('MEDIUM'),
  acceptedCategories: z.array(z.enum(DONATION_CATEGORIES)).min(1, 'Select at least one category'),
  contactPhone: z.string().min(7),
  operatingHours: z.string().optional(),
  active: z.boolean().default(true),
  createdAt: z.string().datetime().optional()
});

/**
 * Rider Schema
 */
export const VEHICLE_TYPES = ['BICYCLE', 'E_BIKE', 'MOTORCYCLE', 'CAR', 'VAN', 'TRUCK', 'WALKER'];
export const RIDER_STATUS = ['OFFLINE', 'AVAILABLE', 'ON_DISPATCH', 'BUSY'];

export const riderLocationSchema = coordinatesSchema.extend({
  heading: z.number().min(0).max(360).optional(),
  speedKmh: z.number().min(0).optional(),
  updatedAt: z.string().datetime()
});

export const riderSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1, 'User ID is required'),
  name: z.string().min(2),
  phone: z.string().min(7),
  vehicleType: z.enum(VEHICLE_TYPES),
  maxCapacityKg: z.number().positive(),
  status: z.enum(RIDER_STATUS).default('OFFLINE'),
  currentLocation: riderLocationSchema.optional(),
  activeAssignmentId: z.string().nullable().default(null),
  createdAt: z.string().datetime().optional()
});

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
  riderId: z.string().nullable().default(null),
  status: z.enum(ALL_ASSIGNMENT_STATUSES).default('UNASSIGNED'),
  pickupLocation: locationSchema,
  deliveryLocation: locationSchema,
  timeline: assignmentTimelineSchema.default({}),
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
  donationId: z.string().min(1, 'Donation ID is required'),
  shelterId: z.string().min(1, 'Shelter ID is required'),
  reservedByUserId: z.string().min(1, 'User ID is required'),
  status: z.enum(RESERVATION_STATUS).default('REQUESTED'),
  requestedQuantity: z.number().positive(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});

/**
 * Event / Audit Schema
 */
export const ENTITY_TYPES = ['DONATION', 'SHELTER', 'RIDER', 'ASSIGNMENT', 'RESERVATION', 'SYSTEM'];

export const eventSchema = z.object({
  id: z.string().optional(),
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().min(1),
  eventType: z.string().min(1),
  actorId: z.string().optional(),
  actorRole: roleSchema.optional(),
  payload: z.record(z.any()).default({}),
  timestamp: z.string().datetime()
});
