Cric4All iOS Phase 2A — Full Change Package
===========================================

SAFE CHANGE APPLIED
-------------------
App/App.xcodeproj/project.pbxproj
  TARGETED_DEVICE_FAMILY changed from "1,2" to 1.

This makes the initial native target iPhone-only. It avoids accidentally
shipping an unvalidated iPad target in the first release.

UNCHANGED ON PURPOSE
--------------------
App/App/AppDelegate.swift
App/App/Info.plist
Capacitor server.url architecture
Push entitlements/capabilities
Signing/team settings
Scoring/offline code
Android project
Prisma/database/API code

WHY PUSH ENTITLEMENTS ARE NOT ADDED
-----------------------------------
The Apple Push Notifications capability and signing entitlements should be
created with the actual Apple Developer team in Xcode after VSJ SERV LLC's
Developer Program membership is active. Adding guessed signing entitlements
now is a regression risk.

WHY server.url IS NOT REMOVED
-----------------------------
The current app loads https://cric4all.app and depends on server-side Next.js
routes/APIs. Removing server.url without a deliberate architecture migration
could break authentication, scoring, league APIs and other production flows.

APP REVIEW RISK TO ADDRESS
--------------------------
Apple Guideline 4.2 requires an app experience beyond a repackaged website.
Before submission, validate and clearly demonstrate Cric4All's app-like value:
purpose-built scoring, offline scoring continuity, native sharing, and native
push/alerts where enabled.

NEXT MAC/XCODE STEPS (do not perform on Windows)
------------------------------------------------
1. Open App/App.xcodeproj with current Xcode.
2. Select the Cric4All App target.
3. Signing & Capabilities -> select VSJ SERV LLC team.
4. Confirm Bundle Identifier com.cric4all.app.
5. Confirm Devices = iPhone.
6. Add Push Notifications capability only after App ID/team is available.
7. Validate icons/launch screen.
8. Build to a physical iPhone.
9. Execute TESTFLIGHT-IPHONE-CHECKLIST.md.
10. Archive and upload to TestFlight.
