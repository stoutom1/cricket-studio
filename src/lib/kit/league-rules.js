export function usesScreenshotDefinedTeamPlayers(league) {
  const normalizedLeagueName = String(league?.name || "")
    .trim()
    .toLowerCase();

  return normalizedLeagueName === "surprise cricket league";
}