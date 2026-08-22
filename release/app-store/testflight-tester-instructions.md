# Cric4All TestFlight Tester Instructions

## Goal
Validate the actual iPhone app before App Review.

## Core test
1. Install Cric4All from TestFlight.
2. Sign in.
3. Open the designated test league.
4. Open an active match.
5. Score legal deliveries.
6. Score an extra.
7. Record a wicket.
8. Undo one delivery.
9. Confirm scorecard and live view agree.

## Offline test
1. Start scoring online.
2. Score several deliveries.
3. Disable Wi-Fi and cellular data.
4. Continue scoring.
5. Navigate through only supported offline flows.
6. Resume the cached scoring match.
7. Score another delivery.
8. Restore connectivity.
9. Continue scoring while synchronization is running.
10. Confirm the queue reaches zero without duplicate/missing deliveries.

## Lifecycle test
- Background and foreground the app during scoring.
- Lock/unlock the iPhone.
- Change Wi-Fi/cellular state while backgrounded.
- Force-close/relaunch and verify expected session/scoring behavior.

## Native integration
- Open the native share sheet from a match.
- Share via Messages.
- Share via WhatsApp if installed.
- Enable App Notifications from the account menu.
- Verify notification permission appears only after the explicit action.
- If APNs is configured, receive and tap a controlled test notification.

## Final
Report:
- iPhone model
- iOS version
- Cric4All build number
- exact steps for any failure
- screenshot/video when useful
