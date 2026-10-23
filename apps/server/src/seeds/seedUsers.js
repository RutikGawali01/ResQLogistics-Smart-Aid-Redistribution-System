import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { ROLES } from '@aidflow/shared';
import { User } from '../models/User.js';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from '../config/database.js';

export const DEMO_USERS = [
  {
    id: 'usr_admin_01',
    name: 'AidFlow Platform Administrator',
    email: 'admin@aidflow.org',
    password: 'AdminPassword123!',
    role: ROLES.ADMIN,
    phone: '+1-555-0100',
    organization: 'AidFlow Global Operations'
  },
  {
    id: 'usr_donor_01',
    name: 'City Food Donor',
    email: 'donor@aidflow.org',
    password: 'DonorPassword123!',
    role: ROLES.DONOR,
    phone: '+1-555-0101',
    organization: 'Metropolitan Harvest Surplus'
  },
  {
    id: 'usr_rider_01',
    name: 'Carlos Ruiz (Courier Rider)',
    email: 'rider@aidflow.org',
    password: 'RiderPassword123!',
    role: ROLES.RIDER,
    phone: '+1-555-0155',
    organization: 'Green Wheel Couriers'
  },
  {
    id: 'usr_shelter_01',
    name: 'Downtown Hope Refuge Manager',
    email: 'shelter@aidflow.org',
    password: 'ShelterPassword123!',
    role: ROLES.SHELTER_MANAGER,
    phone: '+1-555-0188',
    organization: 'Downtown Hope Refuge'
  }
];

/**
 * Generates an in-memory representation of demo accounts with bcrypt-hashed passwords.
 * Useful for decoupled/mock mode when MongoDB is offline.
 */
export function getPrehashedDemoUsers() {
  const saltRounds = 10;
  return DEMO_USERS.map(demoUser => {
    const passwordHash = bcrypt.hashSync(demoUser.password, saltRounds);
    return {
      id: demoUser.id,
      name: demoUser.name,
      email: demoUser.email,
      passwordHash,
      role: demoUser.role,
      phone: demoUser.phone,
      organization: demoUser.organization,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
}

/**
 * Seeds demo accounts into MongoDB.
 */
export async function seedUsers({ disconnectAfter = false } = {}) {
  const wasConnected = isDatabaseConnected();
  if (!wasConnected) {
    await connectDatabase();
  }

  const seeded = [];
  const saltRounds = 10;

  for (const demo of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(demo.password, saltRounds);
    const userDoc = await User.findOneAndUpdate(
      { email: demo.email.toLowerCase() },
      {
        $set: {
          name: demo.name,
          email: demo.email.toLowerCase(),
          passwordHash,
          role: demo.role,
          phone: demo.phone,
          organization: demo.organization,
          active: true
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    seeded.push(userDoc);
  }

  console.log(`[Seed] Seeded ${seeded.length} demo accounts (ADMIN, DONOR, RIDER, SHELTER_MANAGER) into MongoDB.`);

  if (disconnectAfter && !wasConnected) {
    await disconnectDatabase();
  }

  return seeded;
}

// Allow direct CLI execution: node src/seeds/seedUsers.js
const isDirectExecution = process.argv[1] && process.argv[1].endsWith('seedUsers.js');
if (isDirectExecution) {
  seedUsers({ disconnectAfter: true })
    .then(() => {
      console.log('[Seed] Seeding completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Seeding failed:', err);
      process.exit(1);
    });
}
