import twilio from "twilio";

function normalizePhoneNumber(phone) {
  const value = String(phone || "").trim();

  if (!value) {
    throw new Error("Owner phone number is required.");
  }

  return value.startsWith("+")
    ? value
    : `+${value.replace(/\D/g, "")}`;
}

function formatBirthdayNames(birthdays) {
  const names = birthdays
    .map((birthday) =>
      String(
        birthday?.playerName ||
          "Player"
      ).trim()
    )
    .filter(Boolean);

  if (names.length === 0) {
    return "A player";
  }

  if (names.length === 1) {
    return names[0];
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names
    .slice(0, -1)
    .join(", ")}, and ${names.at(-1)}`;
}

export async function sendBirthdayOwnerSms({
  ownerPhone,
  birthdays,
  date,
}) {
  const accountSid =
    process.env.TWILIO_ACCOUNT_SID;

  const authToken =
    process.env.TWILIO_AUTH_TOKEN;

  const fromPhone =
    process.env.TWILIO_SMS_FROM_NUMBER;

  if (!accountSid) {
    throw new Error(
      "TWILIO_ACCOUNT_SID is not configured."
    );
  }

  if (!authToken) {
    throw new Error(
      "TWILIO_AUTH_TOKEN is not configured."
    );
  }

  if (!fromPhone) {
    throw new Error(
      "TWILIO_SMS_FROM_NUMBER is not configured."
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

  const recipient =
    normalizePhoneNumber(ownerPhone);

  const leagueName =
    birthdays[0]?.leagueName ||
    "your Cric4All league";

  const birthdayNames =
    formatBirthdayNames(birthdays);

  const birthdayDate =
    date
      ? ` on ${date}`
      : "";

  const body =
    birthdays.length === 1
      ? `Cric4All reminder: ${birthdayNames} has a birthday${birthdayDate} in ${leagueName}.`
      : `Cric4All reminder: ${birthdayNames} have birthdays${birthdayDate} in ${leagueName}.`;

  const client = twilio(
    accountSid,
    authToken
  );

  const message =
    await client.messages.create({
      from: normalizePhoneNumber(
        fromPhone
      ),
      to: recipient,
      body,
    });

  return {
    messageId: message.sid,
    status:
      message.status || "queued",
    to: message.to,
    from: message.from,
  };
}