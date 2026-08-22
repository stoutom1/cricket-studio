# Cric4All App Store Screenshot Plan

## Initial submission strategy
Cric4All is currently configured as iPhone-only.

Apple allows 1–10 screenshots. Use a coherent set of 6 portrait screenshots.

For the highest-resolution iPhone group, prepare screenshots at an accepted
6.9-inch size. Current accepted portrait sizes include:

- 1260 × 2736
- 1290 × 2796
- 1320 × 2868

Use screenshots captured from the actual TestFlight build wherever possible.

## Recommended 6-screen story

1. **Score Cricket Ball by Ball**
   - Scorer Mode
   - current score visible
   - scoring keypad visible
   - striker/non-striker/bowler visible

2. **Keep Scoring Through Connection Loss**
   - offline indicator
   - active scorer state
   - avoid showing debugging tools or browser chrome

3. **Live Match for Players & Fans**
   - spectator/live score screen
   - target/chase context if visually useful

4. **Complete Match Scorecards**
   - completed match result
   - innings totals / result summary

5. **Manage Your League**
   - professional league/team/match management screen
   - avoid overcrowded admin UI

6. **Share the Match**
   - Cric4All share action or resulting public match page
   - native iOS share sheet may be shown only if it accurately represents the app

## Screenshot rules
- No DevTools, localhost, test failures, debug banners, or fake system alerts.
- Do not include personal phone numbers, emails, player information, or private league data.
- Use a dedicated screenshot/test league.
- Do not advertise functionality that is not present in build 1.0.
- Screenshots should be appropriate for a broad audience.
