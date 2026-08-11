import {
  sendTwilioBirthdayTemplateSms,
  sendTwilioWhatsAppBirthdayMessage,
} from "@/lib/sendTwilioWhatsAppBirthdayMessage";

function getOwnerStatusCallbackUrl(
  reminderLogId
) {
  const baseUrl =
    String(
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://cric4all.app"
    ).replace(/\/+$/, "");

  return (
    `${baseUrl}/api/webhooks/twilio/owner-birthday-status` +
    `?reminderLogId=${encodeURIComponent(
      String(reminderLogId)
    )}`
  );
}

/*
 * Primary delivery: WhatsApp.
 *
 * If Twilio rejects the WhatsApp request immediately, send the SAME
 * ContentSid + SAME variables over SMS immediately.
 *
 * If Twilio accepts WhatsApp but later reports FAILED/UNDELIVERED,
 * the owner-birthday-status webhook performs the SMS fallback.
 */
export async function sendBirthdayOwnerCommunication({
  ownerPhone,
  playerName,
  leagueName,
  birthdayId,
  leagueId,
  reminderLogId,
}) {
  const statusCallbackUrl =
    getOwnerStatusCallbackUrl(
      reminderLogId
    );

  try {
    const whatsapp =
      await sendTwilioWhatsAppBirthdayMessage({
        recipientPhone:
          ownerPhone,

        playerName,

        leagueName,

        birthdayId,

        leagueId,

        statusCallbackUrl,
      });

    return {
      success: true,
      channel: "WHATSAPP",
      messageId:
        whatsapp.messageSid,
      status:
        whatsapp.status,
      fallbackUsed: false,
    };
  } catch (whatsappError) {
    console.error(
      "[OWNER_BIRTHDAY_WHATSAPP_IMMEDIATE_FAILURE]",
      {
        reminderLogId,
        birthdayId,
        leagueId,
        error:
          whatsappError instanceof Error
            ? whatsappError.message
            : String(whatsappError),
      }
    );

    const sms =
      await sendTwilioBirthdayTemplateSms({
        recipientPhone:
          ownerPhone,

        playerName,

        leagueName,
      });

    return {
      success: true,
      channel: "SMS",
      messageId:
        sms.messageSid,
      status:
        sms.status,
      fallbackUsed: true,
      whatsappError:
        whatsappError instanceof Error
          ? whatsappError.message
          : String(whatsappError),
    };
  }
}
