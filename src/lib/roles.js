export const ROLES = {
  OWNER: {
    role: "OWNER",

    canViewDashboard: true,
    canViewManagement: true,
    canViewMatches: true,
    canViewScoring: true,
    canViewStats: true,

    canCreateLeague: true,
    canCreateTeam: true,
    canCreateMatch: true,

    canDeleteLeague: true,
    canDeleteTeam: true,
    canDeletePlayer: true,
    canDeleteMatch: true,

    canScoreMatch: true,
    canEditScore: true,
    canUndoBall: true
  },

  ADMIN: {
    role: "ADMIN",

    canViewDashboard: true,
    canViewManagement: true,
    canViewMatches: true,
    canViewScoring: true,
    canViewStats: true,

    canCreateTeam: true,
    canCreateMatch: true,

    canDeleteTeam: true,
    canDeletePlayer: true,
    canDeleteMatch: true,

    canScoreMatch: true,
    canEditScore: true,
    canUndoBall: true
  },

  SCORER: {
    role: "SCORER",

    canViewMatches: true,
    canViewScoring: true,
    canViewStats: true,

    canScoreMatch: true,
    canEditScore: true,
    canUndoBall: true
  },

  CAPTAIN: {
    role: "CAPTAIN",

    canViewMatches: true,
    canViewScoring: true,
    canViewStats: true,

    canCreateTeam: true
  },

  ANALYST: {
    role: "ANALYST",

    canViewMatches: true,
    canViewStats: true
  },

  VIEWER: {
    role: "VIEWER",

    canViewMatches: true,
    canViewStats: true
  }
};