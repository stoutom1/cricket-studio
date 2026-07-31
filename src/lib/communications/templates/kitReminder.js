function cleanRequiredText(value, fieldName) {
  const cleaned = String(value || "").trim();

  if (!cleaned) {
    throw new Error(`${fieldName} is required.`);
  }

  return cleaned;
}

/**
 * Builds channel-independent kit-reminder content.
 *
 * The WhatsApp template still receives its existing six variables.
 * The fallback SMS body is prepared here so the same communication
 * content can be reused when SMS fallback is added to KitReminderLog.
 */
export function buildKitReminderCommunicationContent({
  playerName,
  teamName,
  opponentName,
  leagueName,
  matchDateText,
  matchTimeText,
}) {
  const cleanPlayerName =
    cleanRequiredText(playerName, "Player name");

  const cleanTeamName =
    cleanRequiredText(teamName, "Team name");

  const cleanOpponentName =
    cleanRequiredText(opponentName, "Opponent name");

  const cleanLeagueName =
    cleanRequiredText(leagueName, "League name");

  const cleanMatchDateText =
    cleanRequiredText(matchDateText, "Match date");

  const cleanMatchTimeText =
    cleanRequiredText(matchTimeText, "Match time");

  return {
    title: `Kit reminder for ${cleanPlayerName}`,

    notificationBody:
      `${cleanTeamName} plays ${cleanOpponentName} ` +
      `on ${cleanMatchDateText} at ${cleanMatchTimeText}.`,

    fallbackSmsBody:
      `Cric4All kit reminder for ${cleanPlayerName}: ` +
      `${cleanTeamName} plays ${cleanOpponentName} ` +
      `on ${cleanMatchDateText} at ${cleanMatchTimeText} ` +
      `in ${cleanLeagueName}. Please remember the team kit.`,

    whatsappVariables: {
      playerName: cleanPlayerName,
      teamName: cleanTeamName,
      opponentName: cleanOpponentName,
      leagueName: cleanLeagueName,
      matchDateText: cleanMatchDateText,
      matchTimeText: cleanMatchTimeText,
    },
  };
}
