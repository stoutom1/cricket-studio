export const ROLES = {
  OWNER: {
    role: "OWNER",

      canViewDashboard:  true,
  canViewManagement:  true,
  canViewMatches:  true,
  canViewScoring:  true,
  canViewStats:  true,

  canCreateLeague:  true,
  canEditLeague:  true,
  canDeleteLeague:  true,

  canManageMembers:  true,
  canManagePermissions:  true,

  canCreateTeam:  true,
  canEditTeam:  true,
  canDeleteTeam:  true,

  canCreatePlayer:  true,
  canEditPlayer:  true,
  canDeletePlayer:  true,

  canCreateMatch:  true,
  canEditMatch:  true,
  canDeleteMatch:  true,

  canScoreMatch:  true,
  canEditScore:  true,
  canUndoBall:  true,
  canSwapStrike:  true,
  canRetirePlayer:  true,

  canEndMatch:  true,
  canAbandonMatch:  true,
  canLockMatch:  true,

  canExportStats:  true,
  canViewAuditLogs:  true,
  },

  ADMIN: {
    role: "ADMIN",

    canViewDashboard: true,
    canViewManagement: true,
    canViewMatches: true,
    canViewScoring: true,
    canViewStats: true,

    canManageMembers: true,

    canCreateTeam: true,
    canEditTeam: true,
    canDeleteTeam: true,

    canCreatePlayer: true,
    canEditPlayer: true,
    canDeletePlayer: true,

    canCreateMatch: true,
    canEditMatch: true,
    canDeleteMatch: true,

    canScoreMatch: true,
    canEditScore: true,
    canUndoBall: true,
    canSwapStrike: true,
    canRetirePlayer: true,

    canEndMatch: true,
    canAbandonMatch: true,

    canExportStats: true
  },

  SCORER: {
    role: "SCORER",

    canViewDashboard: true,
    canViewMatches: true,
    canViewScoring: true,
    canViewStats: true,

    canScoreMatch: true,
    canEditScore: true,
    canUndoBall: true,
    canSwapStrike: true,
    canRetirePlayer: true,

    canEndMatch: true
  },

  CAPTAIN: {
    role: "CAPTAIN",

    canViewDashboard: true,
    canViewMatches: true,
    canViewScoring: true,
    canViewStats: true,

    canCreatePlayer: true,
    canEditPlayer: true,

    canCreateTeam: false,
    canEditTeam: false,
    canDeleteTeam: false,

    canScoreMatch: false,
    canEditScore: false,
    canUndoBall: false
  },

  VIEWER: {
    role: "VIEWER",

    canViewDashboard: true,
    canViewMatches: true,
    canViewStats: true,
    canViewScoring: true,
    canExportStats: true,
    canViewManagement: true
  }
};