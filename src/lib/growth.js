import prisma from "@/lib/prisma";

export const GROWTH_EVENT_TYPES = new Set([
  "LANDING_VIEW",
  "SIGNUP_STARTED",
  "SIGNUP_COMPLETED",
  "LEAGUE_CREATED",
  "TEAM_CREATED",
  "PLAYER_CREATED",
  "MATCH_CREATED",
  "MATCH_STARTED",
  "MATCH_COMPLETED",
  "SECOND_MATCH_COMPLETED",
  "SPECTATOR_VIEW",
  "SPECTATOR_CTA_CLICKED",
  "SHARE_MATCH",
  "SHARE_SCORECARD",
  "AI_REVIEW_OPENED",
  "AI_TEAM_BUILDER_OPENED",
]);

function clean(value, max = 180) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

export async function recordGrowthEvent(input = {}) {
  const eventType = clean(input.eventType, 64);
  if (!eventType || !GROWTH_EVENT_TYPES.has(eventType)) return null;

  try {
    return await prisma.growthEvent.create({
      data: {
        eventType,
        visitorId: clean(input.visitorId, 100),
        sessionId: clean(input.sessionId, 100),
        userId: clean(input.userId, 100),
        leagueId: Number.isInteger(Number(input.leagueId)) ? Number(input.leagueId) : null,
        matchId: Number.isInteger(Number(input.matchId)) ? Number(input.matchId) : null,
        source: clean(input.source, 80),
        path: clean(input.path, 300),
        metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : undefined,
      },
    });
  } catch (error) {
    // Analytics must never block scoring, registration, league creation, etc.
    console.error("[GROWTH_EVENT_FAILED]", eventType, error?.message || error);
    return null;
  }
}

export function growthInternalLeagueIds() {
  return String(process.env.GROWTH_INTERNAL_LEAGUE_IDS || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}
