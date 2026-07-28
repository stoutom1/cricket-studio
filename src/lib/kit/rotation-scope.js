export const KIT_ROTATION_MODES =
  Object.freeze({
    TEAM: "TEAM",
    LEAGUE_PLAYER: "LEAGUE_PLAYER",
  });

export function getKitRotationKey({
  leagueId,
  teamId,
  rotationMode,
}) {
  const parsedLeagueId =
    Number(leagueId);

  const parsedTeamId =
    Number(teamId);

  if (
    !Number.isInteger(parsedLeagueId) ||
    parsedLeagueId <= 0
  ) {
    throw new Error(
      "A valid league id is required."
    );
  }

  if (
    rotationMode ===
    KIT_ROTATION_MODES.LEAGUE_PLAYER
  ) {
    return `LEAGUE:${parsedLeagueId}`;
  }

  if (
    !Number.isInteger(parsedTeamId) ||
    parsedTeamId <= 0
  ) {
    throw new Error(
      "A valid team id is required for team-level kit rotation."
    );
  }

  return `TEAM:${parsedTeamId}`;
}

export function isLeaguePlayerKitRotation(
  rotationMode
) {
  return (
    rotationMode ===
    KIT_ROTATION_MODES.LEAGUE_PLAYER
  );
}