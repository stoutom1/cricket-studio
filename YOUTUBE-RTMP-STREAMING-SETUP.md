# Cric4All Live Streaming — RTMP/RTMPS Setup

## What this feature does

Cric4All adds a **Stream** button to the live match page and generates a transparent, auto-updating scoreboard overlay.

The camera/video feed is sent directly from the encoder (OBS, hardware encoder, etc.) to the third-party platform. Cric4All does **not** receive or store the stream key.

Supported workflow:
- YouTube Live
- Other RTMP/RTMPS platforms
- Facebook Live / Twitch / other providers when they provide an RTMP/RTMPS server and stream key

## One-time setup

No Prisma migration and no Google API credentials are required for this implementation.

Install OBS Studio from the official OBS website.

## How a scorer/user streams a match

1. Open the Cric4All live match page.
2. Click **Stream**.
3. Choose **YouTube Live** or **Other RTMP/RTMPS**.
4. Open the streaming platform's live control room.
5. Create or schedule the live event.
6. Open OBS Studio.
7. Add the camera/capture-card/video source.
8. Add a **Browser Source**.
9. Copy the Cric4All overlay URL shown in the Stream window into that Browser Source.
10. Set the Browser Source to **1920 × 1080**.
11. Put the Cric4All Browser Source above the camera/video source in OBS.
12. Configure OBS with the platform's stream server URL and stream key.
13. Start OBS.
14. Check the platform's live preview.
15. Start/go live on the platform.
16. Continue scoring in Cric4All. The overlay refreshes automatically every few seconds.

## YouTube

YouTube's current encoder workflow is:
- YouTube Studio → Create → Go Live
- Stream tab
- Create/schedule the event
- Copy the Stream URL and Stream Key into the encoder
- Start the encoder
- Verify the preview
- Go live

Use RTMPS when available.

Do not paste the YouTube stream key into Cric4All. It belongs only in the encoder.

## Important security rule

The Cric4All Stream window intentionally never asks for or stores the third-party stream key.

If a stream key is compromised, reset it in the streaming platform's live control room.

## Overlay behavior

The overlay:
- Reads the same public live-score API used by the spectator live page.
- Refreshes every 3 seconds.
- Shows team names, score, overs, striker, non-striker, bowler, recent balls and live status.
- Has a transparent background so the camera/video remains visible.
- Is marked noindex so overlay URLs are not intended for search indexing.

## Ending a stream

Stop the encoder and finish/end the live event in the third-party platform.

Cric4All scoring can continue or finish independently of the streaming platform.

## Future enhancement

A later phase could provide direct mobile camera streaming from inside Cric4All. That would require a media-ingest service/WebRTC/WHIP architecture and is separate from this RTMP/RTMPS encoder-based feature.
