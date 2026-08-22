# Cric4All — Physical iPhone / TestFlight Checklist

Run every item on the actual iPhone before App Review.

## Install and launch
- Fresh TestFlight install launches successfully.
- Cric4All branding, icon and launch screen render correctly.
- No clipped content at Dynamic Island/notch or home indicator.
- Portrait UI has no horizontal overflow.

## Authentication
- Sign in succeeds.
- Session survives background/foreground.
- Session survives app relaunch where expected.
- Sign out succeeds.
- Offline/reconnect UI never falsely grants authenticated permissions.

## Scoring
- Open an existing match.
- Start/resume scoring.
- Record runs, dot balls, extras and wickets.
- Change striker/bowler where applicable.
- Undo behaves correctly.
- End innings/match flow behaves correctly.
- Completed result and spectator view agree.

## Offline scoring
- Start online.
- Score several balls.
- Disable Wi-Fi and cellular data.
- Continue scoring.
- Navigate only through flows intentionally supported offline.
- Resume the cached scoring match.
- Score additional balls.
- Restore connectivity.
- Continue scoring while queued events synchronize.
- Verify queue reaches Synced with no duplicate/missing delivery.
- Verify server scorecard matches the device.

## Share
- Share match result.
- Share spectator/live link.
- Confirm native iOS share sheet opens.
- Test Messages and WhatsApp if installed.
- Confirm shared URL opens the intended public page.

## Push
- Request permission only in a user-understandable context.
- Allow permission and confirm device registration.
- Send a controlled test alert.
- Tap notification and confirm intended destination.
- Test foreground/background behavior.

## Lifecycle
- Background during scoring, return after 30 seconds.
- Lock/unlock iPhone.
- Receive an interruption and return.
- Force-close/relaunch.
- Switch between Wi-Fi and cellular.

## Final
- No debug-only screens.
- No localhost URLs.
- No broken links.
- Privacy, Terms, Help/Contact and account deletion are reachable.
- Review account and backend are active.
