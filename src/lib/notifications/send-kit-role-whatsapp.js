import twilio from "twilio";

let cachedClient = null;

function getTwilioClient() {
  const accountSid = String(
    process.env.TWILIO_ACCOUNT_SID || ""
  ).trim();

  const authToken = String(
    process.env.TWILIO_AUTH_TOKEN || ""
  ).trim();

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

  if (!cachedClient) {
    cachedClient = twilio(
      accountSid,
      authToken
    );
  }

  return cachedClient;
}

function normalizeRecipient(value) {
  const digits = String(value || "")
    .trim()
    .replace(/[^\d+]/g, "");

  const normalized =
    digits.startsWith("+")
      ? digits
      : `+${digits.replace(/\D/g, "")}`;

  if (
    !/^\+[1-9]\d{7,14}$/.test(
      normalized
    )
  ) {
    throw new Error(
      "WhatsApp recipient must use international format, for example +16025551234."
    );
  }

  return normalized;
}

function publicBaseUrl() {
  return String(
    process.env.NEXT_PUBLIC_APP_URL ||
      "https://cric4all.app"
  )
    .trim()
    .replace(/\/+$/, "");
}

function getStatusCallbackUrl() {
  return (
    `${publicBaseUrl()}` +
    "/api/webhooks/kit-whatsapp-status"
  );
}

function cleanVariables(values) {
  return Object.fromEntries(
    Object.entries(values).map(
      ([key, value]) => [
        key,
        String(value || "").trim(),
      ]
    )
  );
}

async function sendTemplate({
  recipientPhone,
  contentSid,
  variables,
  role,
  context,
}) {
  const messagingServiceSid =
    String(
      process.env
        .TWILIO_WHATSAPP_MESSAGING_SERVICE_SID ||
        ""
    ).trim();

  if (!messagingServiceSid) {
    throw new Error(
      "TWILIO_WHATSAPP_MESSAGING_SERVICE_SID is missing."
    );
  }

  if (!contentSid) {
    throw new Error(
      `The WhatsApp Content SID for ${role} is missing.`
    );
  }

  const normalizedRecipient =
    normalizeRecipient(
      recipientPhone
    );

  const statusCallback =
    getStatusCallbackUrl();

  const startedAt =
    Date.now();

  try {
    const message =
      await getTwilioClient()
        .messages.create({
          messagingServiceSid,

          to:
            `whatsapp:${normalizedRecipient}`,

          contentSid,

          contentVariables:
            JSON.stringify(
              cleanVariables(
                variables
              )
            ),

          statusCallback,
        });

    if (!message?.sid) {
      throw new Error(
        "Twilio accepted the WhatsApp request but did not return a Message SID."
      );
    }

    const providerStatus =
      String(
        message.status ||
          "accepted"
      )
        .trim()
        .toUpperCase();

    console.log(
      "[KIT_ROLE_WHATSAPP_ACCEPTED]",
      {
        role,
        providerMessageId:
          message.sid,
        providerStatus,
        recipientPhone:
          normalizedRecipient,
        elapsedMs:
          Date.now() -
          startedAt,
        context,
      }
    );

    return {
      success:
        true,

      queued:
        true,

      delivered:
        false,

      providerMessageId:
        message.sid,

      providerStatus,

      providerErrorCode:
        message.errorCode ||
        null,

      providerErrorMessage:
        message.errorMessage ||
        null,

      providerResponse: {
        role,
        sid:
          message.sid,
        status:
          providerStatus,
        to:
          message.to ||
          `whatsapp:${normalizedRecipient}`,
        messagingServiceSid,
        contentSid,
        statusCallback,
        acceptedAt:
          new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error(
      "[KIT_ROLE_WHATSAPP_FAILED]",
      {
        role,
        recipientPhone:
          normalizedRecipient,
        code:
          error?.code ?? null,
        status:
          error?.status ?? null,
        error:
          error instanceof Error
            ? error.message
            : String(error),
        elapsedMs:
          Date.now() -
          startedAt,
        context,
      }
    );

    throw error;
  }
}

/**
 * Utility template for the player accountable for the upcoming match.
 *
 * Variables:
 * 1 assigned carrier
 * 2 assigned team
 * 3 opponent
 * 4 match date
 * 5 match time
 * 6 current kit holder
 * 7 league
 */
export function sendAssignedCarrierKitWhatsApp({
  recipientPhone,
  assignedCarrierName,
  assignedTeamName,
  opponentName,
  matchDateText,
  matchTimeText,
  currentHolderName,
  leagueName,
  context,
}) {
  return sendTemplate({
    recipientPhone,

    contentSid:
      String(
        process.env
          .TWILIO_KIT_ASSIGNED_CARRIER_CONTENT_SID ||
          ""
      ).trim(),

    variables: {
      1:
        assignedCarrierName,
      2:
        assignedTeamName,
      3:
        opponentName,
      4:
        matchDateText,
      5:
        matchTimeText,
      6:
        currentHolderName,
      7:
        leagueName,
    },

    role:
      "ASSIGNED_CARRIER",

    context,
  });
}

/**
 * Utility template for the person presently holding the shared league kit.
 *
 * Variables:
 * 1 current holder
 * 2 assigned carrier
 * 3 assigned team
 * 4 opponent
 * 5 match date
 * 6 match time
 * 7 league
 */
export function sendCurrentHolderKitWhatsApp({
  recipientPhone,
  currentHolderName,
  assignedCarrierName,
  assignedTeamName,
  opponentName,
  matchDateText,
  matchTimeText,
  leagueName,
  context,
}) {
  return sendTemplate({
    recipientPhone,

    contentSid:
      String(
        process.env
          .TWILIO_KIT_CURRENT_HOLDER_CONTENT_SID ||
          ""
      ).trim(),

    variables: {
      1:
        currentHolderName,
      2:
        assignedCarrierName,
      3:
        assignedTeamName,
      4:
        opponentName,
      5:
        matchDateText,
      6:
        matchTimeText,
      7:
        leagueName,
    },

    role:
      "CURRENT_HOLDER",

    context,
  });
}
