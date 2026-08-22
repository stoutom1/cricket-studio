# Cric4All App Privacy Questionnaire Workbook

This workbook is intentionally NOT a set of final declarations. Verify every
item against the production implementation and the live privacy policy before
submitting App Store Connect privacy answers.

## Data inventory to verify

### Contact / account information
Potential production data:
- name
- email address
- phone number
- account identifiers

Review purposes:
- account functionality
- league administration
- alerts/communications

### User content / cricket information
Potential production data:
- league/team/player details entered by users
- match and scoring data
- uploaded league resources

Map these only to Apple's current App Privacy categories after verifying the
production behavior.

### Identifiers / device data
Potential production data:
- native push token
- web-push subscription details
- device/platform metadata used for notification delivery

### Usage / analytics
The shared Cric4All layout uses Vercel Analytics and Speed Insights.
Verify their current production collection behavior and Apple's applicable
privacy categories.

### Messaging
Review Twilio/SMS/WhatsApp flows:
- phone numbers
- opt-in/consent records
- message delivery status

### Diagnostics / security
Review:
- login history
- IP address or user-agent information
- server logs
- error/diagnostic information

## Tracking
Do not equate analytics with Apple's definition of tracking. Determine whether
Cric4All or any third party links user/device data with third-party data for
advertising or measurement across companies' apps/websites before answering.

## Final verification
- compare actual production behavior
- compare live privacy policy
- review all third-party SDK/services
- update privacy policy if needed
- only then complete App Store Connect
