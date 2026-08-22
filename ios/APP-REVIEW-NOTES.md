# Cric4All — Draft App Review Notes

Cric4All is a cricket scoring and league-management application.

For review, please test the application as an iPhone app rather than as a general-purpose web browser. The primary workflow is cricket match scoring and live match administration.

Recommended review path:
1. Sign in with the review account supplied in App Store Connect.
2. Open the assigned review/test league.
3. Open or create the designated test match.
4. Enter the scoring workflow.
5. Record several legal deliveries and scoring events.
6. Review the scorecard/live match state.
7. Use the Share action to open the native iOS share sheet.
8. If the submitted build includes the finalized offline flow, temporarily disable network connectivity while remaining in the scoring workflow, record test deliveries, restore connectivity, and verify synchronization.

Important:
- Provide Apple with a dedicated active review account and a test league/match with enough permissions to exercise scoring.
- Do not provide personal production credentials.
- Keep all backend services required by the review account available during review.
- If push notifications are enabled in the submitted build, explain exactly how the reviewer can trigger a test notification.
- Update these notes to match the exact submitted build. Do not claim a feature that is not reviewable in that build.

Why the app is more than a repackaged website:
- It provides a purpose-built ball-by-ball cricket scoring workflow.
- Supported in-progress scoring can continue through temporary connectivity loss and synchronize on reconnect.
- Match content can use the native iOS share sheet.
- Native push/alert integration is included when enabled for the submitted build.
- The UI is optimized for scorer and spectator workflows on mobile devices.
