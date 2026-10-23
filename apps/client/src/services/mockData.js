import { ROLES, ASSIGNMENT_STATUS } from '@aidflow/shared';

export const MOCK_USERS = {
  ADMIN: {
    id: 'usr_admin_01',
    name: 'Alex Mercer (Admin)',
    email: 'admin@aidflow.org',
    role: ROLES.ADMIN,
    phone: '+1 (555) 019-2831',
    organization: 'AidFlow Central Command',
    isMock: true
  },
  DONOR: {
    id: 'usr_donor_01',
    name: 'Sarah Jenkins',
    email: 'sarah@freshmarket.com',
    role: ROLES.DONOR,
    phone: '+1 (555) 482-1920',
    organization: 'Fresh Market Grocers',
    isMock: true
  },
  RIDER: {
    id: 'usr_rider_01',
    name: 'Carlos Ruiz',
    email: 'carlos.rider@aidflow.org',
    role: ROLES.RIDER,
    phone: '+1 (555) 773-9021',
    organization: 'Green Wheels Courier Collective',
    isMock: true
  },
  SHELTER_MANAGER: {
    id: 'usr_shelter_01',
    name: 'Elena Rostova',
    email: 'elena@downtownhope.org',
    role: ROLES.SHELTER_MANAGER,
    phone: '+1 (555) 301-4492',
    organization: 'Downtown Hope Refuge',
    isMock: true
  }
};

export const MOCK_DONATIONS = [
  {
    id: 'don_mock_01',
    donorId: 'usr_donor_01',
    title: 'Artisan Sourdough & Fresh Pastries',
    description: 'Surplus morning artisanal loaves, croissants, and baguettes baked fresh today.',
    category: 'BAKERY',
    quantity: 45,
    unit: 'loaves',
    storageRequirement: 'ROOM_TEMPERATURE',
    expirationDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    pickupLocation: {
      address: '220 Market St, San Francisco, CA',
      latitude: 37.7925,
      longitude: -122.3995,
      contactName: 'Golden Grain Bakery',
      contactPhone: '+1 (415) 555-0101'
    },
    status: 'AVAILABLE',
    allergens: ['Gluten', 'Wheat'],
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
  },
  {
    id: 'don_mock_02',
    donorId: 'usr_donor_01',
    title: 'Organic Leafy Greens & Berries Crate',
    description: 'Crisp organic romaine lettuce, kale bundles, and fresh strawberry punnets.',
    category: 'PRODUCE',
    quantity: 85,
    unit: 'kg',
    storageRequirement: 'REFRIGERATED',
    expirationDate: new Date(Date.now() + 86400000 * 1.5).toISOString(),
    pickupLocation: {
      address: '580 Valencia St, San Francisco, CA',
      latitude: 37.7645,
      longitude: -122.4215,
      contactName: 'Mission Organics Hub',
      contactPhone: '+1 (415) 555-0102'
    },
    status: 'ASSIGNED',
    allergens: [],
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 'don_mock_03',
    donorId: 'usr_donor_02',
    title: 'Prepared Roasted Chicken & Rice Bowls',
    description: 'Individually sealed hot bento meals from downtown corporate cafeteria catering.',
    category: 'PREPARED_MEALS',
    quantity: 60,
    unit: 'servings',
    storageRequirement: 'REFRIGERATED',
    expirationDate: new Date(Date.now() + 86400000 * 1).toISOString(),
    pickupLocation: {
      address: '101 California St, San Francisco, CA',
      latitude: 37.7932,
      longitude: -122.3982,
      contactName: 'Skyline Dining Services',
      contactPhone: '+1 (415) 555-0103'
    },
    status: 'IN_TRANSIT',
    allergens: ['Poultry'],
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'don_mock_04',
    donorId: 'usr_donor_01',
    title: 'Pasteurized Whole Milk & Greek Yogurt',
    description: 'Chilled dairy surplus with minimum 5 days shelf life remaining.',
    category: 'DAIRY',
    quantity: 30,
    unit: 'cartons',
    storageRequirement: 'REFRIGERATED',
    expirationDate: new Date(Date.now() + 86400000 * 5).toISOString(),
    pickupLocation: {
      address: '1200 4th St, San Francisco, CA',
      latitude: 37.7725,
      longitude: -122.3912,
      contactName: 'Bay Dairy Depot',
      contactPhone: '+1 (415) 555-0104'
    },
    status: 'AVAILABLE',
    allergens: ['Dairy', 'Lactose'],
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString()
  },
  {
    id: 'don_mock_05',
    donorId: 'usr_donor_03',
    title: 'Emergency Hygiene Kits & Winter Blankets',
    description: 'Sterile toiletries, soap, toothpaste, thermal blankets, and socks in weatherproof packs.',
    category: 'HYGIENE',
    quantity: 50,
    unit: 'kits',
    storageRequirement: 'ROOM_TEMPERATURE',
    expirationDate: new Date(Date.now() + 86400000 * 30).toISOString(),
    pickupLocation: {
      address: '750 Brannan St, San Francisco, CA',
      latitude: 37.7749,
      longitude: -122.4042,
      contactName: 'Community Relief Supplies',
      contactPhone: '+1 (415) 555-0105'
    },
    status: 'AVAILABLE',
    allergens: [],
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
  }
];

export const MOCK_SHELTERS = [
  {
    id: 'shl_mock_01',
    name: 'Downtown Hope Refuge',
    managerId: 'usr_shelter_01',
    address: '100 Mission St, San Francisco, CA',
    location: { latitude: 37.7915, longitude: -122.3980 },
    capacity: { currentOccupancy: 88, maxCapacity: 100, mealsNeededPerDay: 150 },
    urgencyLevel: 'HIGH',
    acceptedCategories: ['PERISHABLE', 'PREPARED_MEALS', 'PRODUCE', 'BAKERY'],
    contactPhone: '+1 (415) 555-9011',
    operatingHours: '24/7 Intake & Kitchen',
    active: true
  },
  {
    id: 'shl_mock_02',
    name: 'St. Jude Community Center',
    managerId: 'usr_shelter_02',
    address: '450 Castro St, San Francisco, CA',
    location: { latitude: 37.7609, longitude: -122.4350 },
    capacity: { currentOccupancy: 34, maxCapacity: 60, mealsNeededPerDay: 80 },
    urgencyLevel: 'MEDIUM',
    acceptedCategories: ['NON_PERISHABLE', 'CLOTHING', 'HYGIENE', 'BAKERY'],
    contactPhone: '+1 (415) 555-9022',
    operatingHours: '07:00 - 21:00',
    active: true
  },
  {
    id: 'shl_mock_03',
    name: 'Harbor Light Emergency Shelter',
    managerId: 'usr_shelter_03',
    address: '240 7th St, San Francisco, CA',
    location: { latitude: 37.7768, longitude: -122.4085 },
    capacity: { currentOccupancy: 115, maxCapacity: 120, mealsNeededPerDay: 200 },
    urgencyLevel: 'CRITICAL',
    acceptedCategories: ['PREPARED_MEALS', 'PRODUCE', 'DAIRY', 'BEVERAGES', 'HYGIENE'],
    contactPhone: '+1 (415) 555-9033',
    operatingHours: '24/7 Full Service',
    active: true
  },
  {
    id: 'shl_mock_04',
    name: 'Mission Youth & Family Haven',
    managerId: 'usr_shelter_04',
    address: '2800 Folsom St, San Francisco, CA',
    location: { latitude: 37.7523, longitude: -122.4146 },
    capacity: { currentOccupancy: 22, maxCapacity: 45, mealsNeededPerDay: 50 },
    urgencyLevel: 'LOW',
    acceptedCategories: ['NON_PERISHABLE', 'BAKERY', 'CLOTHING'],
    contactPhone: '+1 (415) 555-9044',
    operatingHours: '08:00 - 20:00',
    active: true
  }
];

export const MOCK_RIDERS = [
  {
    id: 'rdr_mock_01',
    userId: 'usr_rider_01',
    name: 'Carlos Ruiz',
    phone: '+1 (555) 773-9021',
    vehicleType: 'E_BIKE',
    maxCapacityKg: 40,
    status: 'ON_DISPATCH',
    currentLocation: {
      latitude: 37.7812,
      longitude: -122.4115,
      speedKmh: 18.5,
      heading: 45,
      updatedAt: new Date().toISOString()
    },
    activeAssignmentId: 'asg_mock_02',
    rating: 4.95,
    completedDeliveries: 128
  },
  {
    id: 'rdr_mock_02',
    userId: 'usr_rider_02',
    name: 'Maya Patel',
    phone: '+1 (555) 334-1189',
    vehicleType: 'VAN',
    maxCapacityKg: 450,
    status: 'AVAILABLE',
    currentLocation: {
      latitude: 37.7850,
      longitude: -122.4000,
      speedKmh: 0,
      heading: 0,
      updatedAt: new Date().toISOString()
    },
    activeAssignmentId: null,
    rating: 4.88,
    completedDeliveries: 342
  },
  {
    id: 'rdr_mock_03',
    userId: 'usr_rider_03',
    name: 'Marcus Chen',
    phone: '+1 (555) 882-9901',
    vehicleType: 'MOTORCYCLE',
    maxCapacityKg: 65,
    status: 'AVAILABLE',
    currentLocation: {
      latitude: 37.7690,
      longitude: -122.4310,
      speedKmh: 24,
      heading: 120,
      updatedAt: new Date().toISOString()
    },
    activeAssignmentId: null,
    rating: 4.92,
    completedDeliveries: 94
  },
  {
    id: 'rdr_mock_04',
    userId: 'usr_rider_04',
    name: 'Liam O’Connor',
    phone: '+1 (555) 441-2099',
    vehicleType: 'BICYCLE',
    maxCapacityKg: 25,
    status: 'OFFLINE',
    currentLocation: {
      latitude: 37.7580,
      longitude: -122.4180,
      updatedAt: new Date().toISOString()
    },
    activeAssignmentId: null,
    rating: 4.79,
    completedDeliveries: 62
  }
];

export const MOCK_ASSIGNMENTS = [
  {
    id: 'asg_mock_01',
    donationId: 'don_mock_01',
    donationTitle: 'Artisan Sourdough & Fresh Pastries',
    shelterId: 'shl_mock_01',
    shelterName: 'Downtown Hope Refuge',
    riderId: 'rdr_mock_01',
    riderName: 'Carlos Ruiz',
    status: ASSIGNMENT_STATUS.PENDING_ACCEPTANCE,
    pickupLocation: {
      address: '220 Market St, San Francisco, CA',
      latitude: 37.7925,
      longitude: -122.3995,
      contactName: 'Golden Grain Bakery'
    },
    deliveryLocation: {
      address: '100 Mission St, San Francisco, CA',
      latitude: 37.7915,
      longitude: -122.3980,
      contactName: 'Downtown Hope Reception'
    },
    timeline: {
      assignedAt: new Date(Date.now() - 900000).toISOString()
    },
    notes: 'Fragile bakery items, keep horizontal on rear rack.',
    estimatedMinutes: 12
  },
  {
    id: 'asg_mock_02',
    donationId: 'don_mock_03',
    donationTitle: 'Prepared Roasted Chicken & Rice Bowls',
    shelterId: 'shl_mock_03',
    shelterName: 'Harbor Light Emergency Shelter',
    riderId: 'rdr_mock_01',
    riderName: 'Carlos Ruiz',
    status: ASSIGNMENT_STATUS.DELIVERY_IN_PROGRESS,
    pickupLocation: {
      address: '101 California St, San Francisco, CA',
      latitude: 37.7932,
      longitude: -122.3982,
      contactName: 'Skyline Dining Services'
    },
    deliveryLocation: {
      address: '240 7th St, San Francisco, CA',
      latitude: 37.7768,
      longitude: -122.4085,
      contactName: 'Kitchen Receiving Dock'
    },
    timeline: {
      assignedAt: new Date(Date.now() - 3600000).toISOString(),
      acceptedAt: new Date(Date.now() - 3300000).toISOString(),
      pickedUpAt: new Date(Date.now() - 1800000).toISOString()
    },
    notes: 'Temperature sensitive: hot thermal insulated carrier bags used.',
    estimatedMinutes: 8
  },
  {
    id: 'asg_mock_03',
    donationId: 'don_mock_02',
    donationTitle: 'Organic Leafy Greens & Berries Crate',
    shelterId: 'shl_mock_02',
    shelterName: 'St. Jude Community Center',
    riderId: 'rdr_mock_02',
    riderName: 'Maya Patel',
    status: ASSIGNMENT_STATUS.DELIVERED,
    pickupLocation: {
      address: '580 Valencia St, San Francisco, CA',
      latitude: 37.7645,
      longitude: -122.4215,
      contactName: 'Mission Organics Hub'
    },
    deliveryLocation: {
      address: '450 Castro St, San Francisco, CA',
      latitude: 37.7609,
      longitude: -122.4350,
      contactName: 'St. Jude Pantry Dock'
    },
    timeline: {
      assignedAt: new Date(Date.now() - 14400000).toISOString(),
      acceptedAt: new Date(Date.now() - 14000000).toISOString(),
      pickedUpAt: new Date(Date.now() - 12000000).toISOString(),
      deliveredAt: new Date(Date.now() - 9000000).toISOString()
    },
    notes: 'Successfully delivered. Signed off by Pantry Supervisor.',
    estimatedMinutes: 0
  }
];

export const MOCK_ANALYTICS = {
  totalSurplusKg: 12450,
  mealsProvided: 9820,
  activeDispatches: 6,
  sheltersSupported: 18,
  co2SavedKg: 2860,
  avgDispatchSlaMinutes: 19.4,
  onTimeDeliveryRate: 98.2,
  stateBreakdown: {
    unassigned: 2,
    pending: 3,
    accepted: 1,
    pickupInProgress: 2,
    pickedUp: 1,
    deliveryInProgress: 3,
    deliveredToday: 24
  }
};
