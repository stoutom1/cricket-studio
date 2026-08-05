import Link from "next/link";

export const metadata = {
  title: "SMS Opt-In Information | Cric4All",
  description:
    "How users voluntarily opt in to Cric4All SMS notifications.",
};

export default function SmsOptInPage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <header className="legal-header">
          <p className="legal-eyebrow">
            Cric4All SMS Program
          </p>

          <h1>SMS Opt-In Information</h1>
        </header>

        <section>
          <h2>
            How users provide consent
          </h2>

          <p>
            Cric4All users may voluntarily choose to
            receive SMS notifications when creating
            or updating their Cric4All account.
          </p>

          <p>
            The SMS consent checkbox is optional,
            separate from the general Terms and
            Conditions acceptance, and unchecked by
            default.
          </p>

          <p>
            Users may create and use a Cric4All
            account without agreeing to receive SMS
            messages.
          </p>
        </section>

        <section>
          <h2>
            Consent disclosure
          </h2>

          <div className="sms-consent-fieldset">
            <label className="sms-consent-option">
              <input
                type="checkbox"
                checked={false}
                readOnly
                aria-label="SMS opt-in example"
              />

              <span>
                I agree to receive recurring SMS
                notifications from Cric4All regarding
                match reminders, schedule updates,
                kit assignments, league announcements,
                and account notifications. Message
                frequency varies. Message and data
                rates may apply. Reply STOP to opt out
                or HELP for help. Consent is not a
                condition of creating an account,
                using Cric4All, or purchasing any
                product or service.
              </span>
            </label>
          </div>
        </section>

        <section>
          <h2>
            Program information
          </h2>

          <p>
            Brand: Cric4All
          </p>

          <p>
            Message frequency varies according to
            match schedules, league activity, and
            user notification settings.
          </p>

          <p>
            Message and data rates may apply.
          </p>

          <p>
            Reply STOP to unsubscribe. Reply HELP for
            assistance.
          </p>
        </section>

        <section>
          <h2>Related policies</h2>

          <p>
            <Link href="/terms#sms-terms">
              Cric4All SMS Terms
            </Link>
          </p>

          <p>
            <Link href="/privacy#mobile-messaging-privacy">
              Cric4All Privacy Policy
            </Link>
          </p>
        </section>
      </article>
    </main>
  );
}