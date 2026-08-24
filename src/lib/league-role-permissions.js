export const LEAGUE_ROLES = ["OWNER", "ADMIN", "CAPTAIN", "SCORER", "VIEWER"];

export const ROLE_RANK = {
  VIEWER: 10,
  SCORER: 20,
  CAPTAIN: 30,
  ADMIN: 40,
  OWNER: 50,
};

export const ROLE_LABELS = {
  OWNER: "Owner",
  ADMIN: "Admin",
  CAPTAIN: "Captain",
  SCORER: "Scorer",
  VIEWER: "Viewer / Member",
};

export const PERMISSION_FIELDS = [
  "canViewDashboard", "canViewManagement", "canViewMatches", "canViewScoring", "canViewStats",
  "canCreateLeague", "canEditLeague", "canDeleteLeague", "canManageMembers", "canManagePermissions",
  "canCreateTeam", "canEditTeam", "canDeleteTeam", "canCreatePlayer", "canEditPlayer", "canDeletePlayer",
  "canCreateMatch", "canEditMatch", "canDeleteMatch", "canScoreMatch", "canEditScore", "canUndoBall",
  "canSwapStrike", "canRetirePlayer", "canEndMatch", "canAbandonMatch", "canLockMatch",
  "canExportStats", "canViewAuditLogs",
];

const ALL_FALSE = Object.fromEntries(PERMISSION_FIELDS.map((field) => [field, false]));

export const ROLE_PERMISSION_DEFAULTS = {
  OWNER: Object.fromEntries(PERMISSION_FIELDS.map((field) => [field, true])),
  ADMIN: {
    ...ALL_FALSE,
    canViewDashboard: true, canViewManagement: true, canViewMatches: true, canViewScoring: true, canViewStats: true,
    canEditLeague: true, canManageMembers: true, canManagePermissions: true,
    canCreateTeam: true, canEditTeam: true, canDeleteTeam: true,
    canCreatePlayer: true, canEditPlayer: true, canDeletePlayer: true,
    canCreateMatch: true, canEditMatch: true, canDeleteMatch: true,
    canScoreMatch: true, canEditScore: true, canUndoBall: true, canSwapStrike: true, canRetirePlayer: true,
    canEndMatch: true, canAbandonMatch: true, canLockMatch: true, canExportStats: true, canViewAuditLogs: true,
  },
  CAPTAIN: {
    ...ALL_FALSE,
    canViewDashboard: true, canViewManagement: true, canViewMatches: true, canViewScoring: true, canViewStats: true,
    canCreatePlayer: true, canEditPlayer: true, canCreateMatch: true, canEditMatch: true,
    canScoreMatch: true, canEditScore: true, canUndoBall: true, canSwapStrike: true, canRetirePlayer: true,
    canEndMatch: true, canExportStats: true,
  },
  SCORER: {
    ...ALL_FALSE,
    canViewDashboard: true, canViewMatches: true, canViewScoring: true, canViewStats: true,
    canScoreMatch: true, canEditScore: true, canUndoBall: true, canSwapStrike: true, canRetirePlayer: true,
    canEndMatch: true, canExportStats: true,
  },
  VIEWER: {
    ...ALL_FALSE,
    canViewDashboard: true, canViewMatches: true, canViewStats: true,
  },
};

const ROLE_INVITE_MATRIX = {
  OWNER: ["OWNER", "ADMIN", "CAPTAIN", "SCORER", "VIEWER"],
  ADMIN: ["CAPTAIN", "SCORER", "VIEWER"],
  CAPTAIN: ["SCORER", "VIEWER"],
  SCORER: ["VIEWER"],
  VIEWER: [],
};

export function normalizeLeagueRole(role) {
  const normalized = String(role || "").trim().toUpperCase();
  return LEAGUE_ROLES.includes(normalized) ? normalized : "VIEWER";
}

export function getRolePermissionDefaults(role) {
  return { ...ROLE_PERMISSION_DEFAULTS[normalizeLeagueRole(role)] };
}

export function getLeagueRoleRank(role) {
  return ROLE_RANK[normalizeLeagueRole(role)] || ROLE_RANK.VIEWER;
}

export function isLeagueRolePromotion(currentRole, requestedRole) {
  return getLeagueRoleRank(requestedRole) > getLeagueRoleRank(currentRole);
}

export function getAllowedInviteRoles({ role, permissions, isSuperAdmin = false } = {}) {
  if (isSuperAdmin) return [...LEAGUE_ROLES];

  const allowed = new Set(ROLE_INVITE_MATRIX[normalizeLeagueRole(role)] || []);

  if (permissions?.canManagePermissions === true) {
    allowed.add("CAPTAIN"); allowed.add("SCORER"); allowed.add("VIEWER");
  } else if (permissions?.canManageMembers === true) {
    allowed.add("SCORER"); allowed.add("VIEWER");
  }

  return LEAGUE_ROLES.filter((candidate) => allowed.has(candidate));
}

export function canInviteRole(input, requestedRole) {
  return getAllowedInviteRoles(input).includes(normalizeLeagueRole(requestedRole));
}

export function getPermissionPreview(role) {
  const defaults = getRolePermissionDefaults(role);
  return {
    enabled: PERMISSION_FIELDS.filter((field) => defaults[field] === true),
    disabled: PERMISSION_FIELDS.filter((field) => defaults[field] !== true),
  };
}
