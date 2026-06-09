export const ROLES = ["guest", "resident", "driver", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_HIERARCHY: Record<Role, number> = {
  guest: 0,
  resident: 1,
  driver: 2,
  admin: 3,
};

export function roleSatisfies(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
