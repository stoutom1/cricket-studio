import {
  maskPhoneNumber,
  normalizeInternationalPhone,
} from "@/lib/notifications/phone";

function requiredEnvironmentValue(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
}

/**
 * Sends a pre-approved WhatsApp template through
 * Meta WhatsApp Cloud API.
 *
 * Business-initiated reminders generally need an approved
 * message template. The template name is configured through
 * WHATSAPP_KIT_REMINDER_TEMPLATE.
 */
export async function sendKitReminderWhatsApp({
  phoneNumber,
  playerName,
  teamName,
  opponentName,
  leagueName,
  matchDateText,
  matchTimeText,
}) {
  const normalizedPhone =
    normalizeInternationalPhone(phoneNumber);

  if (!normalizedPhone) {
    throw new Error(
      "The assigned player does not have a valid international WhatsApp number."
    );
  }

  const accessToken =
    requiredEnvironmentValue(
      "WHATSAPP_ACCESS_TOKEN"
    );

  const phoneNumberId =
    requiredEnvironmentValue(
      "WHATSAPP_PHONE_NUMBER_ID"
    );

  const apiVersion =
    String(
      process.env.WHATSAPP_API_VERSION ||
        "v23.0"
    ).trim();

  const templateName =
    requiredEnvironmentValue(
      "WHATSAPP_KIT_REMINDER_TEMPLATE"
    );

  const templateLanguage =
    String(
      process.env
        .WHATSAPP_TEMPLATE_LANGUAGE ||
        "en_US"
    ).trim();

  const requestBody = {
    messaging_product: "whatsapp",

    to: normalizedPhone,

    type: "template",

    template: {
      name: templateName,

      language: {
        code: templateLanguage,
      },

      components: [
        {
          type: "body",

          parameters: [
            {
              type: "text",
              text:
                String(
                  playerName ||
                    "Player"
                ),
            },
            {
              type: "text",
              text:
                String(
                  teamName ||
                    "Your team"
                ),
            },
            {
              type: "text",
              text:
                String(
                  opponentName ||
                    "the opponent"
                ),
            },
            {
              type: "text",
              text:
                String(
                  matchDateText ||
                    "the scheduled date"
                ),
            },
            {
              type: "text",
              text:
                String(
                  matchTimeText ||
                    "the scheduled time"
                ),
            },
            {
              type: "text",
              text:
                String(
                  leagueName ||
                    "your league"
                ),
            },
          ],
        },
      ],
    },
  };

  /*
   * Safe diagnostic log.
   *
   * Never log the access token or full recipient
   * phone number.
   */
  console.log(
    "[KIT_WHATSAPP_REQUEST_CONFIG]",
    {
      apiVersion,
      phoneNumberId,
      templateName,
      templateLanguage,

      maskedPhone:
        maskPhoneNumber(
          normalizedPhone
        ),

      parameterCount:
        requestBody.template
          .components[0]
          .parameters.length,
    }
  );

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${accessToken}`,

        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify(
          requestBody
        ),

      cache:
        "no-store",
    }
  );

  const responseData =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    const providerMessage =
      responseData?.error?.message ||
      "WhatsApp provider rejected the message.";

    const providerCode =
      responseData?.error?.code ||
      null;

    const providerSubcode =
      responseData?.error
        ?.error_subcode ||
      null;

    console.error(
      "[KIT_WHATSAPP_PROVIDER_FAILED]",
      {
        httpStatus:
          response.status,

        providerCode,
        providerSubcode,

        providerMessage,

        phoneNumberId,
        templateName,
        templateLanguage,

        maskedPhone:
          maskPhoneNumber(
            normalizedPhone
          ),

        errorData:
          responseData?.error
            ?.error_data ||
          null,

        fbtraceId:
          responseData?.error
            ?.fbtrace_id ||
          null,
      }
    );

    const error =
      new Error(
        providerMessage
      );

    error.providerResponse =
      responseData;

    error.httpStatus =
      response.status;

    error.maskedPhone =
      maskPhoneNumber(
        normalizedPhone
      );

    throw error;
  }

  console.log(
    "[KIT_WHATSAPP_SENT]",
    {
      providerMessageId:
        responseData
          ?.messages?.[0]?.id ||
        null,

      phoneNumberId,
      templateName,
      templateLanguage,

      maskedPhone:
        maskPhoneNumber(
          normalizedPhone
        ),
    }
  );

  return {
    success: true,

    providerMessageId:
      responseData
        ?.messages?.[0]?.id ||
      null,

    providerResponse:
      responseData,

    maskedPhone:
      maskPhoneNumber(
        normalizedPhone
      ),
  };
}