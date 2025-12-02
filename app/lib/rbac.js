// Centralized Role-Based Access Control (RBAC)

export const Roles = Object.freeze({
  Admin: 'admin',
  Manager: 'Manager',
  FrontDesk: 'Frontdesk',
  Housekeeping: 'Housekeeping',
  Chef: 'Chef',
  Maintenance: 'Maintenance',
  Security: 'Security',
  Owner: 'Owner',
});

// Permissions per module and action
// action keys: view, create, update, delete, manage (full)
export const Permissions = Object.freeze({
  Settings: 'settings',
  Reservations: 'reservations',
  RoomManagement: 'room_management',
  Housekeeping: 'housekeeping',
  Inventory: 'inventory',
  Cafe: 'cafe',
  POs: 'purchase_orders',
  Receipts: 'receipts',
});


export const rolePermissions = {
  [Roles.Admin]: {
    '*': { manage: true },
  },
  [Roles.Manager]: {
    '*': { manage: true },
    [Permissions.Settings]: { manage: true, view: true },
  },
  [Roles.Owner]: {
    '*': { manage: true },
    [Permissions.Settings]: { manage: true, view: true },
  },
  [Roles.FrontDesk]: {
    [Permissions.Reservations]: { manage: true },
    [Permissions.RoomManagement]: { manage: true },
    [Permissions.Housekeeping]: { manage: true },
    [Permissions.POs]: { manage: true },
    [Permissions.Cafe]: { manage: true },
    [Permissions.Receipts]: { manage: true },
    [Permissions.Inventory]: { manage: true, view: true },
  },
  [Roles.Housekeeping]: {
    [Permissions.Housekeeping]: { manage: true, view: true },
    [Permissions.RoomManagement]: { view: true },
    [Permissions.Inventory]: { view: true },
  },
  [Roles.Chef]: {
    [Permissions.Cafe]: { manage: true },
    [Permissions.Receipts]: { manage: true },
    [Permissions.Inventory]: { manage: true, view: true },
  },
  [Roles.Maintenance]: {
    [Permissions.RoomManagement]: { view: true },
    [Permissions.Housekeeping]: { manage: true, view: true },
  },
  [Roles.Security]: {
    [Permissions.RoomManagement]: { view: true },
    [Permissions.Inventory]: { view: true },
  },
};

function resolveRoleKey(role) {
  if (!role) return null;
  const target = String(role).toLowerCase();
  const keys = Object.keys(rolePermissions);
  return keys.find((k) => k.toLowerCase() === target) || null;
}

function getPermissionFor(role, moduleKey) {
  const key = resolveRoleKey(role);
  const roleMap = (key ? rolePermissions[key] : {}) || {};
  const wildcard = roleMap['*'];
  const specific = roleMap[moduleKey];
  return { ...(wildcard || {}), ...(specific || {}) };
}

export function can(role, moduleKey, action) {
  if (!role) return false;
  if (resolveRoleKey(role) === Roles.Admin) return true;

  const perm = getPermissionFor(role, moduleKey);
  if (perm.manage) return true;
  return Boolean(perm[action]);
}

export function requireRole(req, moduleKey, action = 'view') {
  // This helper is intended for server routes using Authorization: Bearer <token>
  // Returns { allowed: boolean, userId?: string, role?: string, message?: string }
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { allowed: false, message: 'No token provided' };
    }
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const role = decoded.role || '';
    // Small, explicit rule: managers may view settings pages.
    // This ensures the Manager role can access settings 'view' endpoints even
    // if role mappings are restrictive elsewhere.
    if (String(role).toLowerCase() === String(Roles.Manager).toLowerCase() && moduleKey === Permissions.Settings && action === 'view') {
      return { allowed: true, userId: decoded.id, role };
    }
    const allowed = can(role, moduleKey, action);
    if (!allowed) {
      return { 
        allowed: false, 
        userId: decoded.id, 
        role, 
        message: `Access denied: Your role (${role}) does not have ${action} permission for ${moduleKey}` 
      };
    }
    return { allowed: true, userId: decoded.id, role };
  } catch (e) {
    // Check if it's a token verification error (authentication failure)
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
      return { allowed: false, message: `Invalid or expired token: ${e.message}` };
    }
    return { allowed: false, message: e.message || 'Unauthorized' };
  }
}

export function maskNavByRole(role, navItems) {
  // navItems: [{ key: 'settings', ... }]
  // Additionally, prevent archived pages from appearing to non-admin/manager roles.
  return navItems.filter((item) => {
    // If the item key indicates an archived page, only allow admin/manager
    if (item && item.key && typeof item.key === 'string' && item.key.startsWith('archived')) {
      const roleKey = String(role || '').toLowerCase();
      if (roleKey === String(Roles.Admin).toLowerCase() || roleKey === String(Roles.Manager).toLowerCase()) {
        return true;
      }
      return false;
    }
    return can(role, item.key, 'view');
  });
}

// Helper: archive access is restricted to Admin and Manager only
export function canAccessArchives(role) {
  if (!role) return false;
  const roleKey = String(role).toLowerCase();
  return roleKey === String(Roles.Admin).toLowerCase() || roleKey === String(Roles.Manager).toLowerCase();
}

// Default landing pages per role (used after login to route users)
export const roleDefaultPages = {
  [Roles.Admin]: 'overview',
  [Roles.Manager]: 'overview',
  [Roles.FrontDesk]: 'rooms',
  [Roles.Housekeeping]: 'rooms',
  [Roles.Chef]: 'cafe-management',
  [Roles.Maintenance]: 'rooms',
  [Roles.Security]: 'rooms',
};

export function defaultPageForRole(role) {
  if (!role) return 'overview';
  const key = resolveRoleKey(role);
  if (!key) return 'overview';
  return roleDefaultPages[key] || 'overview';
}


