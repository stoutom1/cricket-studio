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

function cleanText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

export function buildForwardableBirthdayMessage({
  playerName,
  leagueName,
}) {
  const safePlayerName =
    cleanText(playerName, "Player");

  const safeLeagueName =
    cleanText(leagueName, "Cric4All League");

  /*
   * IMPORTANT:
   * This message is intentionally written as the actual birthday greeting,
   * not as an administrative reminder. The Primary/Backup Owner should be
   * able to forward this text directly into the players WhatsApp group
   * without editing it first.
   */
  return [
    `🎉 Happy Birthday, ${safePlayerName}! 🎂🏏`,
    "",
    "Wishing you a fantastic birthday and a wonderful year ahead filled with happiness, good health, success, and many memorable moments on and off the cricket field.",
    "",
    "Have a great day and keep enjoying the game we all love! 🥳🏏",
    "",
    `— ${safeLeagueName}`,
  ].join("\n");
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
    birthdays.length !== 1
  ) {
    throw new Error(
      "Exactly one birthday is required for a forwardable owner message."
    );
  }

  const recipient =
    normalizePhoneNumber(ownerPhone);

  const birthday = birthdays[0];

  const body =
    buildForwardableBirthdayMessage({
      playerName:
        birthday?.playerName,
      leagueName:
        birthday?.leagueName,
    });

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
    body,
  };
}
