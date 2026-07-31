function clean(value, fallback) {
  const normalized =
    String(value || "").trim();

  return normalized ||
    fallback;
}

export function buildAssignedCarrierKitContent({
  assignedCarrierName,
  assignedTeamName,
  opponentName,
  currentHolderName,
  matchDateText,
  matchTimeText,
  leagueName,
  reminderType,
}) {
  const assigned =
    clean(
      assignedCarrierName,
      "Player"
    );

  const team =
    clean(
      assignedTeamName,
      "your team"
    );

  const opponent =
    clean(
      opponentName,
      "the opponent"
    );

  const holder =
    clean(
      currentHolderName,
      "the current kit holder"
    );

  const league =
    clean(
      leagueName,
      "your league"
    );

  const date =
    clean(
      matchDateText,
      "the scheduled match date"
    );

  const time =
    clean(
      matchTimeText,
      "the scheduled match time"
    );

  const timingText =
    reminderType ===
    "TWO_HOURS_BEFORE"
      ? "The match starts in approximately two hours. "
      : "";

  return {
    fallbackSmsBody:
      `${timingText}${assigned}, you are responsible for ensuring the cricket kit is available for ${team} against ${opponent} on ${date} at ${time}. The kit is recorded with ${holder}. Coordinate with them and ensure the kit reaches the venue before play begins. League: ${league}.`
        .slice(0, 1500),
  };
}

export function buildCurrentHolderKitContent({
  currentHolderName,
  assignedCarrierName,
  assignedTeamName,
  opponentName,
  matchDateText,
  matchTimeText,
  leagueName,
  reminderType,
}) {
  const holder =
    clean(
      currentHolderName,
      "Kit holder"
    );

  const assigned =
    clean(
      assignedCarrierName,
      "the assigned carrier"
    );

  const team =
    clean(
      assignedTeamName,
      "the playing team"
    );

  const opponent =
    clean(
      opponentName,
      "the opponent"
    );

  const league =
    clean(
      leagueName,
      "your league"
    );

  const date =
    clean(
      matchDateText,
      "the scheduled match date"
    );

  const time =
    clean(
      matchTimeText,
      "the scheduled match time"
    );

  const timingText =
    reminderType ===
    "TWO_HOURS_BEFORE"
      ? "The match starts in approximately two hours. "
      : "";

  return {
    fallbackSmsBody:
      `${timingText}${holder}, you are currently recorded as holding the cricket kit. ${assigned} is responsible for ensuring it is available for ${team} against ${opponent} on ${date} at ${time}. Coordinate with them so the kit reaches the venue before play begins. League: ${league}.`
        .slice(0, 1500),
  };
}
