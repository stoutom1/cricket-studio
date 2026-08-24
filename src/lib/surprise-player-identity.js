/**
 * Surprise Cricket League league-wide player identity helpers.
 *
 * IMPORTANT:
 * - This exception applies ONLY to Surprise Cricket League.
 * - Every team in that league participates in one shared player identity pool.
 * - Same normalized player name across any teams in that league represents one
 *   analytics identity.
 * - All other leagues continue to use database Player.id as the identity.
 */
export function normalizeSurprisePlayerName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeSurprisePlayerToken(value) {
  return normalizeSurprisePlayerName(value)
    .replace(/[^a-z0-9]/g, "");
}

export function isSurpriseCricketLeague(league) {
  const name = normalizeSurprisePlayerName(league?.name);
  const slug = normalizeSurprisePlayerName(league?.slug);

  return (
    name === "surprise cricket league" ||
    slug === "surprise-cricket-league"
  );
}

export function getLeagueAnalyticsPlayerKey({
  league,
  playerId,
  playerName,
}) {
  if (isSurpriseCricketLeague(league)) {
    const nameKey = normalizeSurprisePlayerName(playerName);
    return nameKey
      ? `SURPRISE_NAME:${nameKey}`
      : `ID:${Number(playerId) || 0}`;
  }

  if (Number(playerId)) {
    return `ID:${Number(playerId)}`;
  }

  return `NAME:${normalizeSurprisePlayerName(playerName)}`;
}

export function getSurpriseIdentityKey(player, league) {
  if (isSurpriseCricketLeague(league)) {
    const token = normalizeSurprisePlayerToken(player?.name);
    if (token) return `shared:surprise-league:${token}`;
  }

  return `player:${Number(player?.id) || 0}`;
}

export function getSurpriseLeagueTeamLabel(sourceTeams = []) {
  const teams = [...new Set(
    (sourceTeams || [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  )];

  return teams.length ? teams.join(" + ") : "Surprise Cricket League";
}
