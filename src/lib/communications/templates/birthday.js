function cleanRequiredText(value, fieldName) {
  const cleaned = String(value || "").trim();

  if (!cleaned) {
    throw new Error(`${fieldName} is required.`);
  }

  return cleaned;
}

/**
 * Builds channel-independent birthday communication content.
 *
 * Keeping message construction outside the cron makes it reusable
 * by future notification channels and keeps delivery code focused
 * only on routing and provider interaction.
 */
export function buildBirthdayCommunicationContent({
  playerName,
  leagueName,
}) {
  const cleanPlayerName =
    cleanRequiredText(playerName, "Player name");

  const cleanLeagueName =
    cleanRequiredText(leagueName, "League name");

  return {
    title:
      `Birthday greeting for ${cleanPlayerName}`,

    notificationBody:
      `Birthday greeting from ${cleanLeagueName}.`,

    fallbackSmsBody:
      `Happy Birthday, ${cleanPlayerName}! ` +
      `Best wishes from ${cleanLeagueName}. ` +
      `- Cric4All`,
  };
}
