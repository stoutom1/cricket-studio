const DEFAULT_TIME_ZONE =
  process.env.DEFAULT_LEAGUE_TIME_ZONE ||
  "America/Los_Angeles";

export function validTimeZone(value) {
  const candidate =
    String(value || DEFAULT_TIME_ZONE).trim();

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: candidate,
    }).format(new Date());

    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function dateParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  );

  const parts = formatter.formatToParts(date);

  return Object.fromEntries(
    parts
      .filter(
        (part) =>
          part.type !== "literal"
      )
      .map((part) => [
        part.type,
        part.value,
      ])
  );
}

export function localDateKey(
  date,
  timeZone
) {
  const safeTimeZone =
    validTimeZone(timeZone);

  const parts =
    dateParts(
      date,
      safeTimeZone
    );

  return (
    `${parts.year}-` +
    `${parts.month}-` +
    `${parts.day}`
  );
}

export function addDaysToDateKey(
  dateKey,
  numberOfDays
) {
  const [year, month, day] =
    String(dateKey)
      .split("-")
      .map(Number);

  const utcDate = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  utcDate.setUTCDate(
    utcDate.getUTCDate() +
      numberOfDays
  );

  return utcDate
    .toISOString()
    .slice(0, 10);
}

export function isTomorrowInTimeZone({
  scheduledAt,
  now = new Date(),
  timeZone,
}) {
  if (!scheduledAt) {
    return false;
  }

  const safeTimeZone =
    validTimeZone(timeZone);

  const todayKey =
    localDateKey(
      now,
      safeTimeZone
    );

  const tomorrowKey =
    addDaysToDateKey(
      todayKey,
      1
    );

  const matchDateKey =
    localDateKey(
      new Date(scheduledAt),
      safeTimeZone
    );

  return (
    matchDateKey ===
    tomorrowKey
  );
}

/**
 * Returns the number of minutes until a match starts.
 *
 * scheduledAt is an absolute DateTime, so subtraction is
 * timezone-safe. timeZone is accepted for API consistency
 * and validation, but does not change the elapsed duration.
 */
export function minutesUntilMatch({
  scheduledAt,
  now = new Date(),
  timeZone,
}) {
  if (!scheduledAt) {
    return null;
  }

  validTimeZone(timeZone);

  const scheduledDate =
    new Date(scheduledAt);

  const currentDate =
    new Date(now);

  if (
    Number.isNaN(
      scheduledDate.getTime()
    ) ||
    Number.isNaN(
      currentDate.getTime()
    )
  ) {
    return null;
  }

  return (
    scheduledDate.getTime() -
    currentDate.getTime()
  ) / 60000;
}

/**
 * Determines whether a reminder is currently due within
 * a bounded lead-time window.
 *
 * Example:
 *   leadMinutes = 120
 *   windowMinutes = 60
 *
 * The reminder is due when the match starts in more than
 * 60 minutes and no more than 120 minutes.
 *
 * The KitReminderLog unique constraint prevents duplicate
 * sends when the cron runs more than once inside the window.
 */
export function isWithinLeadTimeWindow({
  scheduledAt,
  now = new Date(),
  timeZone,
  leadMinutes,
  windowMinutes,
}) {
  const safeLeadMinutes =
    Number(leadMinutes);

  const safeWindowMinutes =
    Number(windowMinutes);

  if (
    !Number.isFinite(
      safeLeadMinutes
    ) ||
    safeLeadMinutes <= 0
  ) {
    return false;
  }

  if (
    !Number.isFinite(
      safeWindowMinutes
    ) ||
    safeWindowMinutes <= 0 ||
    safeWindowMinutes >
      safeLeadMinutes
  ) {
    return false;
  }

  const remainingMinutes =
    minutesUntilMatch({
      scheduledAt,
      now,
      timeZone,
    });

  if (
    remainingMinutes === null
  ) {
    return false;
  }

  const lowerBound =
    safeLeadMinutes -
    safeWindowMinutes;

  return (
    remainingMinutes >
      lowerBound &&
    remainingMinutes <=
      safeLeadMinutes
  );
}

export function formatMatchDateTime(
  value,
  timeZone
) {
  const date =
    new Date(value);

  const safeTimeZone =
    validTimeZone(timeZone);

  return {
    dateText:
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            safeTimeZone,
          weekday:
            "long",
          month:
            "long",
          day:
            "numeric",
          year:
            "numeric",
        }
      ).format(date),

    timeText:
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            safeTimeZone,
          hour:
            "numeric",
          minute:
            "2-digit",
          timeZoneName:
            "short",
        }
      ).format(date),
  };
}