/**
 * User roles in the AidFlow platform.
 * @readonly
 * @enum {string}
 */
export const ROLES = {
  ADMIN: 'ADMIN',
  DONOR: 'DONOR',
  RIDER: 'RIDER',
  SHELTER_MANAGER: 'SHELTER_MANAGER'
};

/**
 * Array of all supported role identifiers for schema validation.
 */
export const ALL_ROLES = Object.values(ROLES);

/**
 * Metadata and permissions for each role.
 */
export const ROLE_DEFINITIONS = {
  [ROLES.ADMIN]: {
    label: 'Platform Administrator',
    description: 'Full administrative access across dispatch, users, analytics, and platform governance.',
    capabilities: [
      'manage:users',
      'manage:shelters',
      'manage:donations',
      'manage:assignments',
      'view:audit_logs',
      'manage:dispatch_engine'
    ]
  },
  [ROLES.DONOR]: {
    label: 'Aid & Food Donor',
    description: 'Individuals, restaurants, grocers, or organizations donating surplus food and essentials.',
    capabilities: [
      'create:donations',
      'read:my_donations',
      'update:my_donations',
      'cancel:my_donations',
      'view:donation_tracking'
    ]
  },
  [ROLES.RIDER]: {
    label: 'Volunteer / Courier Rider',
    description: 'Volunteer or contracted couriers transporting supplies from donors to shelters.',
    capabilities: [
      'read:dispatch_offers',
      'accept:assignments',
      'update:assignment_status',
      'broadcast:gps_location',
      'read:assigned_routes'
    ]
  },
  [ROLES.SHELTER_MANAGER]: {
    label: 'Shelter / Relief Hub Manager',
    description: 'Operators managing shelters, community kitchens, or relief drop-in centers receiving aid.',
    capabilities: [
      'manage:shelter_profile',
      'update:capacity_levels',
      'create:reservations',
      'confirm:delivery_receipt',
      'read:incoming_deliveries'
    ]
  }
};
