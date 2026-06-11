export default function DeleteAccountPage() {
return ( <main className="max-w-4xl mx-auto px-6 py-10"> <h1 className="text-3xl font-bold mb-6">Delete Your Cric4All Account</h1>

```
  <p className="mb-4">
    If you would like to delete your Cric4All account and associated data,
    please send a request to:
  </p>

  <p className="mb-6">
    <strong>Email:</strong>{" "}
    <a
      href="mailto:support@cric4all.app"
      className="text-blue-600 underline"
    >
      surprisecricket11@gmail.com
    </a>
  </p>

  <h2 className="text-xl font-semibold mb-2">
    What data will be deleted?
  </h2>

  <ul className="list-disc pl-6 space-y-2 mb-6">
    <li>Your Cric4All account information.</li>
    <li>Your profile details.</li>
    <li>Any personal information associated with your account.</li>
  </ul>

  <h2 className="text-xl font-semibold mb-2">
    What data may be retained?
  </h2>

  <ul className="list-disc pl-6 space-y-2">
    <li>
      Match scorecards and league records that are necessary to preserve
      the integrity of tournaments and historical statistics.
    </li>
    <li>Information required to comply with legal obligations.</li>
  </ul>

  <p className="mt-6">
    Account deletion requests are typically processed within 30 days.
  </p>
</main>
);
}
