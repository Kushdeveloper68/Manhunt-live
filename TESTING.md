# Manhunt Live: test on your own Android phone (no Android Studio)

Your PC only runs the **server** and **Metro** (JS bundler). The Android app itself is built
**in the cloud** by EAS, so a low-spec PC is fine.

## 0. One-time setup
1. `git apply` the patches (or unzip the *-files.zip over the repo), then:
   ```
   npm install
   npm run build:shared
   ```
2. Free accounts: https://expo.dev (for EAS) and https://www.mongodb.com/atlas (free M0 cluster).

## 1. Database + server (on the PC)
1. Atlas: create a free cluster, a database user, "Network Access: allow 0.0.0.0/0", then copy
   the connection string (`mongodb+srv://...`). (Or run local Mongo: `docker run -d -p 27017:27017 mongo:7`.)
2. `cp server/.env.example server/.env` and set:
   ```
   MONGODB_URI=<your atlas string>
   JWT_SECRET=<any long random string>
   ALLOW_DEV_GOOGLE_MOCK=true
   ```
3. `cd server && npm run dev`  (leave it running)
4. Find the PC's WiFi IP: `hostname -I` (example 192.168.1.23). The phone must be on the SAME WiFi.
   Check from the phone's browser: `http://192.168.1.23:4000/api/health` should answer.

## 2. App env (on the PC)
`cp app/.env.example app/.env` and set (use YOUR IP):
```
EXPO_PUBLIC_API_URL=http://192.168.1.23:4000/api
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.23:4000
EXPO_PUBLIC_ALLOW_DEV_GOOGLE_MOCK=true
```

## 3. Build the phone app in the cloud (once)
```
npm install -g eas-cli
eas login
cd app
eas init                      # creates the EAS project id
eas build --profile development --platform android
```
When it finishes (free queue can take 10-40 min) open the build link **on the phone**, download the
APK and install it (allow "install unknown apps"). You only rebuild when a NATIVE package changes.

## 4. Run it
```
cd app
npx expo start --dev-client
```
Open the "Manhunt Live" app on the phone, scan the QR (or enter `http://192.168.1.23:8081`).
JS changes now reload instantly.

## 5. Test a full match alone (with bots)
1. Phone: register (email + password), finish profile, permissions: location = **Allow all the time**, notifications = allow.
2. Phone: Create Game. Pin the zone where you are, set reveal interval = 1 min, small head-start. Safety check, create.
3. You are in the host lobby. Note the 6-letter CODE.
4. PC (new terminal): `cd server && npm run simulate -- --code <CODE> --count 3 --center <your lat>,<your lon>`
   (get lat/lon by long-pressing your spot in Google Maps). Bots join and ready up.
5. Phone: assign roles (e.g. you = Chaser, bots = Runners), tap Start.
6. Check: role reveal + countdown, map, reveal pings every minute, zone shrink, no live runner dots outside reveals.
7. TAG: the bot terminal prints `*** TAG CODE: 1234 ***` for each runner bot. Stand within 50 m (bots stay within 25 m of --center), tap TAG, enter the code. Bot confirms after 5 s.
8. SOS: add `--sos-after 30` to the simulate command: bot 1 presses SOS and the host sees a red banner with OPEN MAP.
   Also hold your own SOS button for 3 s: the SOS screen must show REAL coordinates and honest status.
9. Out-of-zone: walk outside the circle: you should get the warning (and the penalty the host chose).

## 6. Background GPS test (most important)
1. Lobby: make a bot your TEAMMATE (bots and you both Runner) and start the match.
2. Lock the phone screen, walk outside for 2-3 minutes.
3. In the bot terminal you must keep seeing `teammate @you at lat, lon (+3.0s)` lines. If the lines stop when the screen locks, background tracking is NOT working.
4. The phone should show the notification "MANHUNT LIVE: match active" while the match runs, and it must disappear after the match.

## Troubleshooting
- `Unable to resolve "query-string"` / `./socketEvents.js` while bundling: pull the latest files, run `npm install` and `npm run build:shared`, then restart with `npx expo start --dev-client --clear`. After EVERY pull that touches `shared/`, run `npm run build:shared` again.
- Phone can't reach the server: same WiFi? AP/client isolation (college WiFi) blocks it. Use your phone hotspot for the PC, or run `npx expo start --dev-client --tunnel`
  and expose the server with a tunnel (cloudflared / ngrok) and use its https URL in app/.env.
- See errors: Metro terminal shows the app's console logs; the server terminal shows server logs. Shake the phone for the dev menu.
- Tracking stops with screen off: Settings > Apps > Manhunt Live > Battery > Unrestricted, and Location = Allow all the time.
- Push notifications need `eas init` (projectId) plus FCM credentials; they are optional for these tests.
