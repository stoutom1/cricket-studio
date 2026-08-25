import prisma from "@/lib/prisma";

export const PLAYER_ROSTER_ARCHIVED_ACTION =
  "PLAYER_ROSTER_ARCHIVED";

export async function getArchivedPlayerIds(
  leagueId,
  client =
    prisma
) {
  const numericLeagueId =
    Number(
      leagueId
    );

  if (
    !Number.isInteger(
      numericLeagueId
    ) ||
    numericLeagueId <= 0
  ) {
    return new Set();
  }

  const rows =
    await client.auditLog.findMany({
      where: {
        leagueId:
          numericLeagueId,
        action:
          PLAYER_ROSTER_ARCHIVED_ACTION,
        entityType:
          "PLAYER",
        playerId: {
          not:
            null,
        },
      },
      select: {
        playerId:
          true,
      },
      orderBy: {
        createdAt:
          "desc",
      },
    });

  return new Set(
    rows
      .map(
        (row) =>
          Number(
            row.playerId
          )
      )
      .filter(
        (id) =>
          Number.isInteger(
            id
          ) &&
          id > 0
      )
  );
}

export function filterArchivedPlayers(
  players,
  archivedPlayerIds
) {
  const archived =
    archivedPlayerIds instanceof
    Set
      ? archivedPlayerIds
      : new Set(
          archivedPlayerIds ||
            []
        );

  return (
    players ||
    []
  ).filter(
    (player) =>
      !archived.has(
        Number(
          player?.id
        )
      )
  );
}

export async function filterArchivedPlayersFromTeams(
  teams,
  leagueId,
  client =
    prisma
) {
  const archived =
    await getArchivedPlayerIds(
      leagueId,
      client
    );

  return (
    teams ||
    []
  ).map(
    (team) => ({
      ...team,
      players:
        filterArchivedPlayers(
          team.players,
          archived
        ),
    })
  );
}
