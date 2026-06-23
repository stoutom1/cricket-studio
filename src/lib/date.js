export function formatMatchDateTime(value) {
  if (!value) return "";

  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function getMatchTimelineText(match) {
  if (!match) return "Date TBD";

  const status = String(match.status || "").toUpperCase();

  if (status === "COMPLETED_LOCKED") {
    return [
      match.endedAt ? `Ended ${formatMatchDateTime(match.endedAt)}` : null,
      match.lockedAt ? `Locked ${formatMatchDateTime(match.lockedAt)}` : null,
    ]
      .filter(Boolean)
      .join(" • ");
  }

  if (status === "ABANDONED") {
    return match.endedAt
      ? `Abandoned ${formatMatchDateTime(match.endedAt)}`
      : "Abandoned";
  }

  if (match.endedAt) {
    return `Ended ${formatMatchDateTime(match.endedAt)}`;
  }

  if (match.startedAt) {
    return `Started ${formatMatchDateTime(match.startedAt)}`;
  }

  if (match.scheduledAt) {
    return `Scheduled ${formatMatchDateTime(match.scheduledAt)}`;
  }

  return "Date TBD";
}