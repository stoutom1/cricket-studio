import {
  sendTwilioBirthdayTemplateSms,
} from "@/lib/sendTwilioWhatsAppBirthdayMessage";

/*
 * Player birthday SMS fallback.
 *
 * IMPORTANT:
 * The fallback uses the SAME Twilio birthday ContentSid/template
 * and the SAME content variables as the WhatsApp birthday message.
 *
 * This removes the old free-form SMS body path so WhatsApp and SMS
 * cannot drift into different birthday wording.
 */
export async function sendTwilioBirthdaySmsFallback({
  recipientPhone,
  playerName,
  leagueName,
  reminderLogId,
  birthdayId,
  leagueId,
}) {
  const normalizedPlayerName =
    String(playerName || "").trim() ||
    "Player";

  const normalizedLeagueName =
    String(leagueName || "").trim() ||
    "Cric4All League";

  console.log(
    "[BIRTHDAY_SMS_FALLBACK_TEMPLATE_SEND]",
    {
      reminderLogId,
      birthdayId,
      leagueId,
      recipientPhone,
      playerName:
        normalizedPlayerName,
      leagueName:
        normalizedLeagueName,
    }
  );

  try {
    /*
     * This is the exact same template-SMS helper already used by
     * the owner birthday fallback.
     *
     * It uses:
     *   TWILIO_BIRTHDAY_CONTENT_SID
     *   {{1}} = playerName
     *   {{2}} = leagueName
     */
    const result =
      await sendTwilioBirthdayTemplateSms({
        recipientPhone,

        playerName:
          normalizedPlayerName,

        leagueName:
          normalizedLeagueName,
      });

    console.log(
      "[BIRTHDAY_SMS_FALLBACK_ACCEPTED]",
      {
        reminderLogId,
        birthdayId,
        leagueId,
        recipientPhone,

        messageSid:
          result.messageSid,

        providerStatus:
          result.status,
      }
    );

    return {
      success: true,

      messageSid:
        result.messageSid,

      status:
        String(
          result.status ||
          "ACCEPTED"
        ).toUpperCase(),

      recipient:
        result.recipient ||
        recipientPhone,
    };
  } catch (error) {
    console.error(
      "[BIRTHDAY_SMS_FALLBACK_SEND_FAILED]",
      {
        reminderLogId,
        birthdayId,
        leagueId,
        recipientPhone,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      }
    );

    throw error;
  }
}
