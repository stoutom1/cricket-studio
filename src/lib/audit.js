import prisma from "@/lib/prisma";

export async function logAudit({
  action,
  entityType,
  entityId = null,
  leagueId = null,
  matchId = null,
  teamId = null,
  playerId = null,
  actor = null,
  description = "",
  beforeData = null,
  afterData = null,
  request = null,
}) {
  try {
    const headers = request?.headers;

    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId: entityId ? Number(entityId) : null,

        leagueId: leagueId ? Number(leagueId) : null,
        matchId: matchId ? Number(matchId) : null,
        teamId: teamId ? Number(teamId) : null,
        playerId: playerId ? Number(playerId) : null,

        actorUserId: actor?.id ? Number(actor.id) : null,
        actorName: actor?.name || null,
        actorEmail: actor?.email || null,

        description,
        beforeData,
        afterData,

        ipAddress:
          headers?.get("x-forwarded-for") ||
          headers?.get("x-real-ip") ||
          null,

        userAgent: headers?.get("user-agent") || null,
      },
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}