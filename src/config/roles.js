export const ROLES = {
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  CASHIER: "CASHIER",
  SALES: "SALES",
  WAREHOUSE: "WAREHOUSE",
};

export const ROLE_LABELS = {
  [ROLES.PLATFORM_ADMIN]: "Platforma administratori",
  [ROLES.OWNER]: "Egasi",
  [ROLES.ADMIN]: "Administrator",
  [ROLES.MANAGER]: "Menejer",
  [ROLES.CASHIER]: "Kassir",
  [ROLES.SALES]: "Sotuvchi",
  [ROLES.WAREHOUSE]: "Omborchi",
};

const VALID_ROLES = new Set(Object.values(ROLES));

export const isOrganizationUser = (user) => Boolean(
  user?.organizationId && user?.appRole !== ROLES.PLATFORM_ADMIN
);

export const runForOrganizationUser = (user, action) => {
  if (!isOrganizationUser(user)) return false;
  action();
  return true;
};

export const legacyRoleForAppRole = (appRole) => {
  if (appRole === ROLES.CASHIER) return "cashier";
  if (appRole === ROLES.SALES) return "sales";
  if (appRole === ROLES.WAREHOUSE) return "warehouse";
  if (appRole === ROLES.MANAGER) return "manager";
  if (appRole === ROLES.OWNER) return "owner";
  if (appRole === ROLES.PLATFORM_ADMIN) return "platform_admin";
  return "admin";
};

export const normalizeAppRole = (user) => {
  const explicit = String(user?.appRole || "").toUpperCase();
  if (VALID_ROLES.has(explicit)) return explicit;
  const legacy = String(user?.role || "").toLowerCase();
  if (legacy === "cashier") return ROLES.CASHIER;
  if (legacy === "manager") return ROLES.MANAGER;
  if (legacy === "sales") return ROLES.SALES;
  if (legacy === "warehouse") return ROLES.WAREHOUSE;
  if (legacy === "platform_admin" || legacy === "platform") return ROLES.PLATFORM_ADMIN;
  if (legacy === "owner") return ROLES.OWNER;
  if (legacy === "admin") return ROLES.ADMIN;
  return ROLES.CASHIER;
};

export const normalizeSessionUser = (user) => {
  if (!user || typeof user !== "object") return null;
  const appRole = normalizeAppRole(user);
  return {
    ...user,
    appRole,
    role: legacyRoleForAppRole(appRole),
  };
};
