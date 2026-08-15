import twilio from "twilio";

function normalizeProviderStatus(value) {
  return String(value || "ACCEPTED")
    .trim()
    .toUpperCase();
}

function normalizePhone(value) {
  const phone = String(value || "").trim();

  if (!phone) {
    throw new Error(
      "A recipient phone number is required."
    );
  }

  return phone;
}

function getErrorMessage(error) {
  return String(
    error instanceof Error
      ? error.message
      : error
  ).slice(0, 1000);
}

let cachedSmsClient =
  null;

function getSmsTwilioClient() {
  const accountSid =
    String(
      process.env
        .TWILIO_ACCOUNT_SID ||
      ""
    ).trim();

  const authToken =
    String(
      process.env
        .TWILIO_AUTH_TOKEN ||
      ""
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

  if (!cachedSmsClient) {
    cachedSmsClient =
      twilio(
        accountSid,
        authToken
      );
  }

  return cachedSmsClient;
}

function normalizeSmsRecipient(
  value
) {
  const raw =
    String(value || "")
      .trim();

  const normalized =
    raw.startsWith("+")
      ? raw.replace(
          /[^\d+]/g,
          ""
        )
      : `+${raw.replace(
          /\D/g,
          ""
        )}`;

  if (
    !/^\+[1-9]\d{7,14}$/.test(
      normalized
    )
  ) {
    throw new Error(
      "SMS recipient must use international E.164 format."
    );
  }

  return normalized;
}

async function sendImmediateKitSmsFallback({
  recipientPhone,
  messageBody,
  context,
  primaryError,
}) {
  const messagingServiceSid =
    String(
      process.env
        .TWILIO_SMS_MESSAGING_SERVICE_SID ||
      ""
    ).trim();

  if (!messagingServiceSid) {
    throw new Error(
      "TWILIO_SMS_MESSAGING_SERVICE_SID is missing."
    );
  }

  const normalizedRecipient =
    normalizeSmsRecipient(
      recipientPhone
    );

  const body =
    String(
      messageBody || ""
    ).trim();

  if (!body) {
    throw new Error(
      "Kit SMS fallback body is missing."
    );
  }

  const startedAt =
    Date.now();

  console.log(
    "[KIT_SMS_IMMEDIATE_FALLBACK_REQUEST]",
    {
      recipientPhone:
        normalizedRecipient,
      messagingServiceSid,
      bodyLength:
        body.length,
      primaryErrorCode:
        primaryError?.code ??
        null,
      primaryErrorStatus:
        primaryError?.status ??
        null,
      primaryError:
        getErrorMessage(
          primaryError
        ),
      context,
    }
  );

  const message =
    await getSmsTwilioClient()
      .messages.create({
        messagingServiceSid,
        to:
          normalizedRecipient,
        body,
      });

  if (!message?.sid) {
    throw new Error(
      "Twilio accepted the kit SMS fallback but did not return a Message SID."
    );
  }

  const providerStatus =
    normalizeProviderStatus(
      message.status ||
      "ACCEPTED"
    );

  console.log(
    "[KIT_SMS_IMMEDIATE_FALLBACK_ACCEPTED]",
    {
      recipientPhone:
        normalizedRecipient,
      messageSid:
        message.sid,
      providerStatus,
      elapsedMs:
        Date.now() -
        startedAt,
      context,
    }
  );

  return {
    success: true,
    skipped: false,
    type:
      "KIT_REMINDER",
    transport:
      "SMS",
    provider:
      "TWILIO",
    messageSid:
      message.sid,
    providerMessageId:
      message.sid,

    /*
     * The existing kit summary treats SENT as a completed immediate
     * provider submission rather than "awaiting WhatsApp callback".
     */
    status:
      "SENT",
    providerStatus:
      "SENT",

    actualProviderStatus:
      providerStatus,

    recipient:
      message.to ||
      normalizedRecipient,

    fallbackEligible:
      true,
    fallbackUsed:
      true,
    fallbackMessageBody:
      body,

    primaryError:
      getErrorMessage(
        primaryError
      ),

    providerResponse: {
      transport:
        "SMS",
      fallbackUsed:
        true,
      sid:
        message.sid,
      status:
        providerStatus,
      to:
        message.to ||
        normalizedRecipient,
      messagingServiceSid,
      primaryErrorCode:
        primaryError?.code ??
        null,
      primaryErrorStatus:
        primaryError?.status ??
        null,
      primaryError:
        getErrorMessage(
          primaryError
        ),
      acceptedAt:
        new Date()
          .toISOString(),
    },
  };
}

/**
 * Standard entry point for player communications.
 *
 * Milestone 2 / PR 1 intentionally keeps the existing Twilio
 * birthday sender as the primary transport. This service provides
 * a stable, generic result contract so birthday, kit and future
 * reminders can migrate incrementally without changing provider
 * behavior or callback routing.
 */
export async function sendPlayerCommunication({
  type,
  consentGranted,
  recipientPhone,
  fallbackEligible = false,
  fallbackBody = null,
  context = {},
  sendPrimary,
}) {
  const communicationType =
    String(type || "").trim().toUpperCase();

  if (!communicationType) {
    throw new Error(
      "Communication type is required."
    );
  }

  if (consentGranted !== true) {
    return {
      success: false,
      skipped: true,
      reason:
        "COMMUNICATION_CONSENT_NOT_GRANTED",
      type: communicationType,
      transport: null,
      fallbackEligible: false,
    };
  }

  const normalizedPhone =
    normalizePhone(recipientPhone);

  if (typeof sendPrimary !== "function") {
    throw new Error(
      "A primary communication sender is required."
    );
  }

  const startedAt = Date.now();

  try {
    const providerResult =
      await sendPrimary();

    const providerMessageId = String(
      providerResult?.messageSid ||
      providerResult?.providerMessageId ||
      ""
    ).trim();

    if (!providerMessageId) {
      throw new Error(
        "The communication provider did not return a message ID."
      );
    }

    const providerStatus =
      normalizeProviderStatus(
        providerResult?.status ||
        providerResult?.providerStatus
      );

    console.log(
      "[PLAYER_COMMUNICATION_PRIMARY_ACCEPTED]",
      {
        type: communicationType,
        transport: "WHATSAPP",
        provider: "TWILIO",
        providerMessageId,
        providerStatus,
        recipientPhone:
          normalizedPhone,
        fallbackEligible:
          fallbackEligible === true,
        elapsedMs:
          Date.now() - startedAt,
        context,
      }
    );

    return {
      success: true,
      skipped: false,
      type: communicationType,
      transport: "WHATSAPP",
      provider: "TWILIO",
      messageSid:
        providerMessageId,
      providerMessageId,
      status:
        providerStatus,
      providerStatus,
      recipient:
        providerResult?.recipient ||
        normalizedPhone,
      fallbackEligible:
        fallbackEligible === true,
      fallbackBody:
        fallbackBody
          ? String(fallbackBody)
          : null,
      elapsedMs:
        Date.now() - startedAt,
      rawResult:
        providerResult,
    };
  } catch (error) {
    const errorMessage =
      getErrorMessage(error);

    console.error(
      "[PLAYER_COMMUNICATION_PRIMARY_FAILED]",
      {
        type: communicationType,
        transport: "WHATSAPP",
        provider: "TWILIO",
        recipientPhone:
          normalizedPhone,
        fallbackEligible:
          fallbackEligible === true,
        elapsedMs:
          Date.now() - startedAt,
        context,
        error:
          errorMessage,
        providerCode:
          error?.code ??
          null,
        providerStatus:
          error?.status ??
          null,
      }
    );

    /*
     * KIT REMINDERS ONLY:
     *
     * If Twilio rejects the WhatsApp request immediately (for example
     * 20422 / Invalid Parameter), there will never be a WhatsApp status
     * callback. Send the already-built SMS fallback now.
     *
     * Birthday behavior is intentionally unchanged because birthday has
     * its own fallback/webhook implementation.
     */
    const canUseImmediateKitFallback =
      communicationType ===
        "KIT_REMINDER" &&
      fallbackEligible ===
        true &&
      Boolean(
        String(
          fallbackBody || ""
        ).trim()
      );

    if (
      canUseImmediateKitFallback
    ) {
      try {
        return await sendImmediateKitSmsFallback({
          recipientPhone:
            normalizedPhone,
          messageBody:
            fallbackBody,
          context,
          primaryError:
            error,
        });
      } catch (
        fallbackError
      ) {
        console.error(
          "[KIT_SMS_IMMEDIATE_FALLBACK_FAILED]",
          {
            recipientPhone:
              normalizedPhone,
            context,
            primaryError:
              errorMessage,
            fallbackError:
              getErrorMessage(
                fallbackError
              ),
            fallbackCode:
              fallbackError?.code ??
              null,
            fallbackStatus:
              fallbackError?.status ??
              null,
          }
        );

        /*
         * Preserve the original WhatsApp failure as the thrown error,
         * while attaching the fallback error for logs/debugging.
         */
        try {
          error.kitSmsFallbackError =
            getErrorMessage(
              fallbackError
            );
        } catch {
          // Ignore if provider error is not extensible.
        }
      }
    }

    throw error;
  }
}
