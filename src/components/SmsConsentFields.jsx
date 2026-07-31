"use client";

import Link from "next/link";

export const SMS_CONSENT_TEXT =
  "I agree to receive recurring SMS/WhatsApp notifications from Cric4All regarding match reminders, schedule updates, kit assignments, league announcements, and account notifications. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of creating an account, using Cric4All, or purchasing any product or service.";

export default function SmsConsentFields({
  phoneNumber,
  smsOptIn,
  onPhoneNumberChange,
  onSmsOptInChange,
  disabled = false,
}) {
  return (
    <fieldset
      className="sms-consent-fieldset"
      disabled={disabled}
    >
      <legend>
        Optional SMS notifications
      </legend>

      <label
        className="form-label"
        htmlFor="smsPhoneNumber"
      >
        Mobile phone number
      </label>

      <input
        id="smsPhoneNumber"
        name="smsPhoneNumber"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+1 480 637 3627"
        value={phoneNumber}
        onChange={(event) =>
          onPhoneNumberChange(
            event.target.value
          )
        }
        className="form-input"
      />

      <p className="sms-consent-hint">
        Include the country code. SMS enrollment
        is optional.
      </p>

      <label
        className="sms-consent-option"
        htmlFor="smsOptIn"
      >
        <input
          id="smsOptIn"
          name="smsOptIn"
          type="checkbox"
          checked={smsOptIn}
          onChange={(event) =>
            onSmsOptInChange(
              event.target.checked
            )
          }
        />

        <span>
          {SMS_CONSENT_TEXT}
        </span>
      </label>

      <p className="sms-consent-links">
        Review the{" "}
        <Link
          href="/terms#sms-terms"
          target="_blank"
          rel="noopener noreferrer"
        >
          SMS Terms
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy#mobile-messaging-privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </fieldset>
  );
}