import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { User } from './models/User.js';
import { Donation } from './models/Donation.js';
import { Shelter } from './models/Shelter.js';
import { Rider } from './models/Rider.js';
import { Assignment } from './models/Assignment.js';
import { Event } from './models/Event.js';
import { Reservation } from './models/Reservation.js';
import { ROLES, ASSIGNMENT_STATUS } from '@aidflow/shared';

export async function runSeed({ quiet = false } = {}) {
  const log = (...args) => {
    if (!quiet) console.log(...args);
  };

  log('\n🌱 [AidFlow Seed] Starting database seeding...');
  await connectDatabase();

  // Clear existing collections
  await Promise.all([
    User.deleteMany({}),
    Donation.deleteMany({}),
    Shelter.deleteMany({}),
    Rider.deleteMany({}),
    Assignment.deleteMany({}),
    Event.deleteMany({}),
    Reservation.deleteMany({})
  ]);

  log('🧹 Cleared existing collections.');

  // 1. Seed Users (userSchema.pre('save') automatically hashes passwords with bcrypt)
  const adminPassword = 'AidFlowAdmin!2026';
  const defaultPassword = 'Password123!';

  const admin = await User.create({
    name: 'Alex Mercer (Platform Admin)',
    email: 'admin@aidflow.org',
    password: adminPassword,
    role: ROLES.ADMIN,
    phone: '+1 (555) 019-2831',
    organization: 'AidFlow Central Command'
  });

  const donor1 = await User.create({
    name: 'Sarah Jenkins',
    email: 'sarah@freshmarket.com',
    password: defaultPassword,
    role: ROLES.DONOR,
    phone: '+1 (555) 482-1920',
    organization: 'Fresh Market Grocers'
  });

  const donor2 = await User.create({
    name: 'Marco Bellini',
    email: 'marco@goldengrain.com',
    password: defaultPassword,
    role: ROLES.DONOR,
    phone: '+1 (555) 301-4492',
    organization: 'Golden Grain Artisans'
  });

  const riderUser1 = await User.create({
    name: 'Carlos Ruiz',
    email: 'carlos.rider@aidflow.org',
    password: defaultPassword,
    role: ROLES.RIDER,
    phone: '+1 (555) 773-9021',
    organization: 'Green Wheels Courier Collective'
  });

  const riderUser2 = await User.create({
    name: 'Maya Patel',
    email: 'maya.rider@aidflow.org',
    password: defaultPassword,
    role: ROLES.RIDER,
    phone: '+1 (555) 334-1189',
    organization: 'City Cargo Van Logistics'
  });

  const shelterManager1 = await User.create({
    name: 'Elena Rostova',
    email: 'elena@downtownhope.org',
    password: defaultPassword,
    role: ROLES.SHELTER_MANAGER,
    phone: '+1 (555) 301-4492',
    organization: 'Downtown Hope Refuge'
  });

  const shelterManager2 = await User.create({
    name: 'Rev. Thomas Hayes',
    email: 'thomas@stjude.org',
    password: defaultPassword,
    role: ROLES.SHELTER_MANAGER,
    phone: '+1 (555) 902-1100',
    organization: 'St. Jude Community Center'
  });

  // Generic convenience role accounts
  await User.create({
    name: 'City Food Donor',
    email: 'donor@aidflow.org',
    password: defaultPassword,
    role: ROLES.DONOR,
    phone: '+1 (555) 0101',
    organization: 'Metropolitan Harvest Surplus'
  });

  await User.create({
    name: 'Carlos Ruiz (Courier Rider)',
    email: 'rider@aidflow.org',
    password: defaultPassword,
    role: ROLES.RIDER,
    phone: '+1 (555) 0155',
    organization: 'Green Wheel Couriers'
  });

  await User.create({
    name: 'Downtown Hope Refuge Manager',
    email: 'shelter@aidflow.org',
    password: defaultPassword,
    role: ROLES.SHELTER_MANAGER,
    phone: '+1 (555) 0188',
    organization: 'Downtown Hope Refuge'
  });

  log(`✅ Seeded ${10} users.`);

  // 2. Seed Shelters
  const shelter1 = await Shelter.create({
    managerId: shelterManager1._id,
    name: 'Downtown Hope Refuge',
    address: '100 Mission St, San Francisco, CA',
    location: {
      address: '100 Mission St, San Francisco, CA',
      latitude: 37.7915,
      longitude: -122.3980,
      contactName: 'Elena Rostova',
      contactPhone: '+1 (415) 555-9011'
    },
    currentDemand: 150,
    receivingCapacity: 200,
    availableResources: ['REFRIGERATION', 'HOT_KITCHEN', 'DRY_STORAGE', 'PALLET_JACK'],
    isOpen: true,
    capacity: { currentOccupancy: 88, maxCapacity: 100, mealsNeededPerDay: 150 },
    urgencyLevel: 'HIGH',
    acceptedCategories: ['PERISHABLE', 'PREPARED_MEALS', 'PRODUCE', 'BAKERY'],
    contactPhone: '+1 (415) 555-9011'
  });

  const shelter2 = await Shelter.create({
    managerId: shelterManager2._id,
    name: 'St. Jude Community Center',
    address: '450 Castro St, San Francisco, CA',
    location: {
      address: '450 Castro St, San Francisco, CA',
      latitude: 37.7609,
      longitude: -122.4350,
      contactName: 'Rev. Thomas Hayes',
      contactPhone: '+1 (415) 555-9022'
    },
    currentDemand: 80,
    receivingCapacity: 120,
    availableResources: ['DRY_STORAGE', 'CLOTHING_SORTING'],
    isOpen: true,
    capacity: { currentOccupancy: 34, maxCapacity: 60, mealsNeededPerDay: 80 },
    urgencyLevel: 'MEDIUM',
    acceptedCategories: ['NON_PERISHABLE', 'CLOTHING', 'HYGIENE', 'BAKERY'],
    contactPhone: '+1 (415) 555-9022'
  });

  const shelter3 = await Shelter.create({
    managerId: shelterManager1._id,
    name: 'Harbor Light Emergency Shelter',
    address: '240 7th St, San Francisco, CA',
    location: {
      address: '240 7th St, San Francisco, CA',
      latitude: 37.7768,
      longitude: -122.4085,
      contactName: 'Intake Desk',
      contactPhone: '+1 (415) 555-9033'
    },
    currentDemand: 220,
    receivingCapacity: 250,
    availableResources: ['REFRIGERATION', 'HOT_KITCHEN', 'EMERGENCY_INTAKE'],
    isOpen: true,
    capacity: { currentOccupancy: 115, maxCapacity: 120, mealsNeededPerDay: 220 },
    urgencyLevel: 'CRITICAL',
    acceptedCategories: ['PREPARED_MEALS', 'PRODUCE', 'DAIRY', 'BEVERAGES', 'HYGIENE'],
    contactPhone: '+1 (415) 555-9033'
  });

  log(`✅ Seeded ${3} shelters.`);

  // 3. Seed Riders
  const rider1 = await Rider.create({
    userId: riderUser1._id,
    name: 'Carlos Ruiz',
    phone: '+1 (555) 773-9021',
    vehicleType: 'E_BIKE',
    capacity: 40,
    maxCapacityKg: 40,
    availableCapacity: 40,
    isAvailable: true,
    status: 'AVAILABLE',
    currentLocation: {
      latitude: 37.7812,
      longitude: -122.4115,
      address: 'Market & 5th St',
      speedKmh: 18.5,
      heading: 45,
      updatedAt: new Date()
    }
  });

  const rider2 = await Rider.create({
    userId: riderUser2._id,
    name: 'Maya Patel',
    phone: '+1 (555) 334-1189',
    vehicleType: 'VAN',
    capacity: 450,
    maxCapacityKg: 450,
    availableCapacity: 450,
    isAvailable: true,
    status: 'AVAILABLE',
    currentLocation: {
      latitude: 37.7850,
      longitude: -122.4000,
      address: 'Downtown Depot',
      speedKmh: 0,
      heading: 0,
      updatedAt: new Date()
    }
  });

  log(`✅ Seeded ${2} couriers.`);

  // 4. Seed Donations
  const donation1 = await Donation.create({
    donorId: donor2._id,
    title: 'Artisan Sourdough & Fresh Pastries',
    description: 'Surplus morning artisanal loaves, croissants, and baguettes baked fresh today.',
    aidType: 'BAKERY',
    category: 'BAKERY',
    quantity: 60,
    availableQuantity: 60,
    unit: 'loaves',
    handlingRequirements: 'ROOM_TEMPERATURE',
    storageRequirement: 'ROOM_TEMPERATURE',
    safeUseDeadline: new Date(Date.now() + 86400000 * 2),
    expirationDate: new Date(Date.now() + 86400000 * 2),
    pickupLocation: {
      address: '220 Market St, San Francisco, CA',
      latitude: 37.7925,
      longitude: -122.3995,
      contactName: 'Golden Grain Bakery',
      contactPhone: '+1 (415) 555-0101'
    },
    status: 'AVAILABLE',
    allergens: ['Gluten', 'Wheat']
  });

  const donation2 = await Donation.create({
    donorId: donor1._id,
    title: 'Organic Leafy Greens & Berries Crate',
    description: 'Crisp organic romaine lettuce, kale bundles, and fresh strawberry punnets.',
    aidType: 'PRODUCE',
    category: 'PRODUCE',
    quantity: 90,
    availableQuantity: 65,
    unit: 'kg',
    handlingRequirements: 'REFRIGERATED',
    storageRequirement: 'REFRIGERATED',
    safeUseDeadline: new Date(Date.now() + 86400000 * 1.5),
    expirationDate: new Date(Date.now() + 86400000 * 1.5),
    pickupLocation: {
      address: '580 Valencia St, San Francisco, CA',
      latitude: 37.7645,
      longitude: -122.4215,
      contactName: 'Mission Organics Hub',
      contactPhone: '+1 (415) 555-0102'
    },
    status: 'AVAILABLE',
    allergens: []
  });

  const donation3 = await Donation.create({
    donorId: donor1._id,
    title: 'Prepared Roasted Chicken & Rice Bowls',
    description: 'Individually sealed hot bento meals from downtown corporate cafeteria catering.',
    aidType: 'PREPARED_MEALS',
    category: 'PREPARED_MEALS',
    quantity: 75,
    availableQuantity: 0, // Fully allocated to assignment
    unit: 'servings',
    handlingRequirements: 'REFRIGERATED',
    storageRequirement: 'REFRIGERATED',
    safeUseDeadline: new Date(Date.now() + 86400000),
    expirationDate: new Date(Date.now() + 86400000),
    pickupLocation: {
      address: '101 California St, San Francisco, CA',
      latitude: 37.7932,
      longitude: -122.3982,
      contactName: 'Skyline Dining Services',
      contactPhone: '+1 (415) 555-0103'
    },
    status: 'ASSIGNED',
    allergens: ['Poultry']
  });

  const donation4 = await Donation.create({
    donorId: donor1._id,
    title: 'Pasteurized Whole Milk & Greek Yogurt',
    description: 'Chilled dairy surplus with minimum 5 days shelf life remaining.',
    aidType: 'DAIRY',
    category: 'DAIRY',
    quantity: 40,
    availableQuantity: 40,
    unit: 'cartons',
    handlingRequirements: 'REFRIGERATED',
    storageRequirement: 'REFRIGERATED',
    safeUseDeadline: new Date(Date.now() + 86400000 * 5),
    expirationDate: new Date(Date.now() + 86400000 * 5),
    pickupLocation: {
      address: '1200 4th St, San Francisco, CA',
      latitude: 37.7725,
      longitude: -122.3912,
      contactName: 'Bay Dairy Depot',
      contactPhone: '+1 (415) 555-0104'
    },
    status: 'AVAILABLE',
    allergens: ['Dairy', 'Lactose']
  });

  log(`✅ Seeded ${4} donations.`);

  // 5. Seed Assignments
  const assignment1 = await Assignment.create({
    donationId: donation3._id,
    shelterId: shelter3._id,
    riderId: rider1._id,
    allocatedQuantity: 75,
    status: ASSIGNMENT_STATUS.PICKUP_IN_PROGRESS,
    deadline: donation3.safeUseDeadline,
    pickupLocation: donation3.pickupLocation,
    deliveryLocation: shelter3.location,
    timeline: {
      assignedAt: new Date(Date.now() - 3600000),
      acceptedAt: new Date(Date.now() - 3300000),
      pickedUpAt: null
    },
    notes: 'Hot insulated carrier bags required. Urgent shelter intake.'
  });

  // Link rider to active assignment
  rider1.activeAssignmentId = assignment1._id;
  rider1.status = 'ON_DISPATCH';
  rider1.isAvailable = false;
  rider1.availableCapacity = 0;
  await rider1.save();

  // Completed assignment
  const assignment2 = await Assignment.create({
    donationId: donation2._id,
    shelterId: shelter2._id,
    riderId: rider2._id,
    allocatedQuantity: 25,
    status: ASSIGNMENT_STATUS.DELIVERED,
    deadline: new Date(Date.now() - 3600000),
    pickupLocation: donation2.pickupLocation,
    deliveryLocation: shelter2.location,
    timeline: {
      assignedAt: new Date(Date.now() - 14400000),
      acceptedAt: new Date(Date.now() - 14000000),
      pickedUpAt: new Date(Date.now() - 12000000),
      deliveredAt: new Date(Date.now() - 9000000)
    },
    notes: 'Delivered directly to St. Jude walk-in pantry.'
  });

  log(`✅ Seeded ${2} assignments.`);

  // 6. Seed Reservations
  await Reservation.create({
    assignmentId: assignment1._id,
    donationId: donation2._id,
    shelterId: shelter1._id,
    reservedByUserId: shelterManager1._id,
    quantity: 25,
    requestedQuantity: 25,
    status: 'CONFIRMED',
    expiresAt: new Date(Date.now() + 3600000 * 3)
  });

  // 7. Seed Events
  await Event.create([
    {
      entityType: 'DONATION',
      entityId: donation1._id.toString(),
      eventType: 'DONATION_CREATED',
      actorId: donor2._id,
      actorRole: ROLES.DONOR,
      metadata: { aidType: 'BAKERY', quantity: 60, unit: 'loaves' }
    },
    {
      entityType: 'SHELTER',
      entityId: shelter3._id.toString(),
      eventType: 'SHELTER_DEMAND_UPDATED',
      actorId: shelterManager1._id,
      actorRole: ROLES.SHELTER_MANAGER,
      metadata: { currentDemand: 220, urgencyLevel: 'CRITICAL' }
    },
    {
      entityType: 'ASSIGNMENT',
      entityId: assignment1._id.toString(),
      eventType: 'ASSIGNMENT_CREATED',
      actorId: admin._id,
      actorRole: ROLES.ADMIN,
      metadata: { allocatedQuantity: 75, riderId: rider1._id }
    },
    {
      entityType: 'ASSIGNMENT',
      entityId: assignment1._id.toString(),
      eventType: 'STATE_TRANSITION',
      actorId: riderUser1._id,
      actorRole: ROLES.RIDER,
      metadata: { previousStatus: 'ACCEPTED', newStatus: 'PICKUP_IN_PROGRESS' }
    }
  ]);

  log(`✅ Seeded audit events.`);
  log('🎉 Database seeding complete!\n');

  return {
    admin,
    donor1,
    donor2,
    rider1,
    rider2,
    shelter1,
    shelter2,
    shelter3,
    donation1,
    donation2,
    donation3,
    assignment1,
    assignment2
  };
}

// Direct execution from CLI: node src/seed.js
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  runSeed()
    .then(async () => {
      await disconnectDatabase();
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
