export default function PrivacyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>

      <p className="mb-4">
        Last Updated: June 2026
      </p>

      <p className="mb-4">
        Cric4All respects your privacy. We collect only the information
        necessary to provide cricket scoring and league management services.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">
        Information We Collect
      </h2>

      <ul className="list-disc pl-6 space-y-2">
        <li>Name and email address used for account registration.</li>
        <li>Match, team, player, and scoring information entered by users.</li>
        <li>Device information required for app functionality and notifications.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">
        How We Use Information
      </h2>

      <ul className="list-disc pl-6 space-y-2">
        <li>To provide and improve Cric4All services.</li>
        <li>To authenticate users.</li>
        <li>To deliver live scoring updates and notifications.</li>
        <li>To respond to support requests.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">
        Data Sharing
      </h2>

      <p className="mb-4">
        We do not sell your personal information to third parties.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">
        Contact Us
      </h2>

      <p>
        If you have any questions regarding this Privacy Policy, please contact
        us at{" "}
        <a
          href="mailto:support@cric4all.app"
          className="text-blue-600 underline"
        >
          support@cric4all.app
        </a>.
      </p>
    </main>
  );
}