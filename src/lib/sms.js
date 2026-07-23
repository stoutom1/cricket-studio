import twilio from "twilio";

function getTwilioClient() {
  const accountSid =
    process.env.TWILIO_ACCOUNT_SID;

  const authToken =
    process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid) {
    throw new Error(
      "TWILIO_ACCOUNT_SID is missing."
    );
  }

  if (!authToken) {
    throw new Error(
      "TWILIO_AUTH_TOKEN is missing."
    );
  }

  return twilio(accountSid, authToken);
}

function normalizeBaseUrl(value) {
  return String(
    value || "https://cric4all.app"
  ).replace(/\/+$/, "");
}

function buildBirthdayPageUrl({
  birthdays,
  date,
}) {
  const baseUrl = normalizeBaseUrl(
    process.env.NEXT_PUBLIC_APP_URL
  );

  const firstLeagueId =
    birthdays.find(
      (birthday) => birthday.leagueId
    )?.leagueId || null;

  const searchParams =
    new URLSearchParams();

  if (date) {
    searchParams.set("date", date);
  }

  if (birthdays.length === 1) {
    const birthday = birthdays[0];

    if (birthday.birthdayId) {
      searchParams.set(
        "birthdayId",
        String(birthday.birthdayId)
      );
    }

    if (birthday.leagueId) {
      searchParams.set(
        "leagueId",
        String(birthday.leagueId)
      );
    }
  } else if (firstLeagueId) {
    /*
     * When all birthdays happen to belong to one
     * league, include that league ID.
     */
    const uniqueLeagueIds = new Set(
      birthdays
        .map((birthday) => birthday.leagueId)
        .filter(Boolean)
        .map(String)
    );

    if (uniqueLeagueIds.size === 1) {
      searchParams.set(
        "leagueId",
        String(firstLeagueId)
      );
    }
  }

  searchParams.set("source", "sms");

  const queryString =
    searchParams.toString();

  return queryString
    ? `${baseUrl}/birthdays/today?${queryString}`
    : `${baseUrl}/birthdays/today`;
}

function groupBirthdaysByLeague(
  birthdays
) {
  const grouped = new Map();

  for (const birthday of birthdays) {
    const leagueName =
      birthday.leagueName ||
      "Cric4All League";

    if (!grouped.has(leagueName)) {
      grouped.set(leagueName, []);
    }

    grouped
      .get(leagueName)
      .push(
        birthday.playerName ||
          "Player"
      );
  }

  return grouped;
}

function buildBirthdaySummary(
  birthdays
) {
  const grouped =
    groupBirthdaysByLeague(
      birthdays
    );

  const lines = [];

  for (const [
    leagueName,
    playerNames,
  ] of grouped.entries()) {
    lines.push(
      `${leagueName}: ${playerNames.join(", ")}`
    );
  }

  return lines;
}

export async function sendBirthdayOwnerSms({
  ownerPhone,
  birthdays,
  date,
}) {
  if (!ownerPhone) {
    throw new Error(
      "Owner phone number is required."
    );
  }

  if (
    !Array.isArray(birthdays) ||
    birthdays.length === 0
  ) {
    throw new Error(
      "At least one birthday is required."
    );
  }

  const fromPhone =
    process.env.TWILIO_PHONE_NUMBER;

  if (!fromPhone) {
    throw new Error(
      "TWILIO_PHONE_NUMBER is missing."
    );
  }

  const birthdayPageUrl =
    buildBirthdayPageUrl({
      birthdays,
      date,
    });

  const summaryLines =
    buildBirthdaySummary(
      birthdays
    );

  const birthdayCount =
    birthdays.length;

  const heading =
    birthdayCount === 1
      ? "Cric4All birthday today"
      : `Cric4All: ${birthdayCount} birthdays today`;

  /*
   * Avoid emojis in SMS.
   *
   * Emojis cause SMS to use Unicode encoding,
   * which significantly lowers the number of
   * characters allowed in each billable segment.
   */
  const body = [
    heading,
    "",
    ...summaryLines,
    "",
    "Tap to view and share the birthday wish:",
    birthdayPageUrl,
  ].join("\n");

  console.log(
    "Birthday SMS request:",
    {
      to: ownerPhone,
      from: fromPhone,
      birthdayCount,
      birthdayPageUrl,
    }
  );

  const message =
    await getTwilioClient()
      .messages.create({
        from: fromPhone,
        to: ownerPhone,
        body,
      });

  return {
    success: true,
    messageId: message.sid,
    status: message.status,
    to: message.to,
    from: message.from,
    birthdayPageUrl,
  };
}