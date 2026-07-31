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
      }
    );

    throw error;
  }
}
