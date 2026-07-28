import { normalizeKitPlayerName } from "./name-normalization";

export function findBestPlayerMatch({
  extractedName,
  selectedTeamId,
  leaguePlayers,
  useScreenshotDefinedTeamPlayers,
}) {
  const normalizedExtractedName =
    normalizeKitPlayerName(extractedName);

  const candidates = leaguePlayers.filter((player) => {
    const normalizedPlayerName =
      normalizeKitPlayerName(player.name);

    if (normalizedPlayerName !== normalizedExtractedName) {
      return false;
    }

    if (useScreenshotDefinedTeamPlayers) {
      return true;
    }

    return Number(player.teamId) === Number(selectedTeamId);
  });

  if (candidates.length === 1) {
    return {
      status: "MATCHED",
      player: candidates[0],
    };
  }

  if (candidates.length > 1) {
    return {
      status: "REVIEW_REQUIRED",
      candidates,
    };
  }

  return {
    status: "NOT_FOUND",
    candidates: [],
  };
}