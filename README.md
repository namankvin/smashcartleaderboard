# SmashKart event control

Dark-mode organizer dashboard for student/RFID/walk-in registration, reversible three-track preparation, per-player laps, timers and results. The car identities match the Gazebo tracker: **Car 1 Red**, **Car 2 Blue**, **Car 3 Green**.

## Start the website

1. Run `npm ci`.
2. Put the directory at `data/contacts.json` (excluded from Git), or set `CONTACTS_FILE` to its server-side path.
3. Set `MONGODB_URI` and `MONGODB_DB_NAME` in `.env.local`.
4. Run `npm run import:contacts` to upsert the directory. The supplied 9,934 source rows contain 9,933 unique roll numbers. Re-importing does not duplicate students.
5. Run `npm run dev`, or `npm run build` followed by `npm start`. Open http://127.0.0.1:3000.

MongoDB is required for durable event data. During local development only, with no database configured, the fallback session only lasts for the current process. Hosted deployments require MongoDB. When MongoDB is configured but unavailable, race mutations fail rather than claiming that timings were saved.

## Registration

- **Student:** enter a roll number to retrieve the student's details and add them to the waiting queue. Unknown roll numbers are rejected.
- **Walk-in / visitor:** only name is required. Email, phone and extras/notes are optional. A generated internal guest ID distinguishes people with identical names. Edit their profile before, during or after racing from the directory, queue, active track or history. Profile edits preserve identity and recorded timing snapshots.
- **RFID:** under setup tools, pair a card UID with a known student roll number. Send scans to `POST /api/webhook/rfid` as `{ "uid": "CARD_UID" }`. Resolved `{ "rollNo": "..." }` registrations also remain supported. Duplicate scans cannot create another waiting entry or register an active player twice.

The physical reader must provide its UID over HTTP (directly or through the team's existing reader service); reading USB/serial hardware is not implemented in the web browser. Pair real cards using the actual reader's UID format before the event.

If `INTEGRATION_TOKEN` is set, RFID scans and telemetry require `Authorization: Bearer <token>`. Keep the token on the reader/bridge server, not in browser code. The browser RFID API tester uses the separate RFID_API_KEY header described below. Full organizer sign-in is separate deployment work.

## Prepare and run a race

1. Register players in the shared waiting queue.
2. Assign individual players to tracks or choose any three in the desired Red/Blue/Green order.
3. Before starting, **Return to queue** restores the original registration ID, check-in time and position. **Return all to queue** cancels preparation. **Change track** moves a player to an empty track or swaps two occupied tracks. Queue transfers and the arena state are committed together in MongoDB.
4. Choose **Laps per player** (1–100; default 3) before starting.
5. Click **Start race**. Track assignments and the lap target now lock. Profile editing remains available.
6. Record each finish-line crossing with **Record lap**, or use the tracker bridge below. Each player's last required lap automatically stops that player's timer; others keep racing.
7. Lap times, cumulative race time, source/event identity and participant snapshots save on every crossing. Refreshing or restarting the website restores the same race and recorded laps. Running clocks use saved start timestamps; an outage does not invent or recover finish-line crossings that the tracker did not deliver.
8. Pause/resume controls exclude paused time from subsequent lap durations. A finished player cannot restart. Recorded laps cannot be erased with reset controls. Penalties are kept separately from raw lap durations.
9. **Save results & next round** archives the round and prepares a new race ID. Ending a paused race early requires confirmation and stores incomplete entries as **Did not finish**; they do not earn podium positions. Lap records are already durable before this button is used.

Explicitly removing an unplayed guest from the waiting queue deletes their walk-in profile. Any saved lap, archived race entry or active track assignment protects the profile. Student directory records are retained. Assigning a guest to a track never deletes their profile.

## Automatic tracker connection

The current `RC_Gazebo/track/hybrid_tracking.py` sends WebSocket frames containing `car`, cumulative `lap`, `timestamp` (Unix seconds), `status` and `in_tunnel`. Start this repository's bridge **before racing**:

```sh
npm run tracker:bridge
```

It listens on `ws://127.0.0.1:8081` and forwards validated lap-crossing events to this website at http://127.0.0.1:3000. Start the team's tracker with its endpoint pointed at the bridge:

```sh
python track/hybrid_tracking.py --endpoint ws://127.0.0.1:8081
```

Run the tracker command from the RC_Gazebo checkout using its configured Python environment. The bridge replaces the old dashboard's WebSocket relay for this connection; the old `run_web.py` also uses port 3000 and must not compete with this website for that port.

Optional bridge arguments:

```sh
npm run tracker:bridge -- --origin http://127.0.0.1:3000 --port 8081
```

Set `INTEGRATION_TOKEN` in the bridge process environment if the website requires it. The standalone bridge does not read the website's `.env.local` automatically.

The bridge captures a pre-start counter baseline for each car, converts cumulative sensor counts into race-relative lap numbers, and attaches the current race ID. It rejects counter jumps, unobserved/tunnel predictions and stale race events. Without a pre-start baseline, that car needs manual lap recording for the round. Keep the tracker running before and throughout the race. Laptop/camera hosts must use synchronized clocks.

This is a software adapter, not proof that a coloured blob correctly crossed the finish line. The Gazebo chat identified off-road detection and missing checkpoint validation in the current hybrid tracker. Those physical/tracking rules must be calibrated and verified before using automatic counts as official results. No missing lap is fabricated after a frame gap. If the bridge flags a gap or rejected timestamp, use the manual controls and inspect the detection before resuming automation in a new round.

## Saved data in MongoDB

| Collection | Contents |
| --- | --- |
| `students` | Imported student directory, unique roll numbers |
| `walk_ins` | Editable visitor profiles |
| `rfid_cards` | Unique card UID → student roll pairing |
| `queue` | Waiting registrations and original check-in times |
| `arena_state` | Current race ID, target laps, assignments, timer state and recorded laps |
| `lap_records` | One immutable record per player's lap, with timestamp, duration and participant snapshot |
| `race_results` | Per-player current/final results, including all laps, penalties and participant details |
| `rounds` | Archived race history; also supplies older lap records for the leaderboard |

View these under the configured database in Atlas Data Explorer. The current database is `sk-leaderboard`. `lap_records` and `race_results` are saved even if the operator has not archived the round yet. There is no winner-only filtering when saving laps.

All arena mutations use MongoDB transactions. The session helper attaches the transaction to existing repository reads/writes, so profile creation, queue transfers, lap inserts and arena updates share one commit. Unique lap keys and ordered lap numbers make retries idempotent.

## Verification

- `npx tsc --noEmit` — type checks.
- `npm run build` — production build.
- `npm run test:rfid-contract` — primary/fallback RFID handler contract tests with a simulated database; no Atlas connection required.
- `npm run test:laps` — isolated MongoDB tests for UID pairing, scan deduplication, every player's laps, automatic stops, pause/resume, bad/duplicate/stale event rejection, failed-write rollback, restart recovery and synthetic WebSocket tracker integration.
- `BROWSER_QA=1 npm run test:walk-ins` — existing registration/editing/queue tests plus desktop/mobile browser checks, dark mode and manual lap completion. Requires Google Chrome on macOS.
- `npm run test:registration` — earlier smoke checks against an empty running local session.

The two isolated suites launch a separate local server on port 3101, use uniquely named temporary databases, and delete only their own test database when finished. They must run sequentially because they share that port.

## Race-day work remaining

- Wire the actual RFID reader/service, enroll real card UIDs and verify scans on the venue network.
- Mount/calibrate cameras and finish-line/checkpoint detection. Verify Red/Blue/Green vehicle mapping, lighting, occlusion, tunnels, reverse driving and false detections with physical cars.
- Start the tracker/bridge before racing, synchronize clocks, test a complete multi-player race, and rehearse dropped frames, network loss, pause/recovery and manual fallback.
- Put the website on a reliable event host, configure HTTPS/admin authentication and integration tokens, Atlas network access, backups, and stable power/network connectivity.
- Confirm official lap targets, penalties, interrupted-race rules, and daily/overall standings. Separate two-day championship rules and power-ups remain outside this timing implementation.

## Embedded-team RFID API contract

Primary: `POST /api/arcade/scan`

Identical fallback: `POST /api/rfid/scan`

Headers:

```text
Content-Type: application/json
x-api-key: <RFID_API_KEY from the server environment>
```

The new hardware endpoints require `RFID_API_KEY`; they return 503 if it is not configured and 401 for missing/incorrect keys. Add the same environment variable in Vercel or another hosting provider when deploying. The local environment is configured with the key supplied in the reference specification. Secrets are not returned by the public metadata route or API details panel.

Payload examples (send one identifier):

```json
{ "rollNumber": "23CEB0B10" }
```

`rollNo` is an equivalent resolved-roll field. `rfid` accepts either a paired card UID or a resolved student roll number. `uid` strictly requires a saved card pairing. All successful scans use the same RFID registration queue; scanning through the fallback cannot duplicate an existing entry.

When `rollNumber` (or `rollNo` / `roll_no`) is not found in the student directory, its trimmed value is registered as a walk-in guest name. For example, `{ "rollNumber": "Rahul Sharma" }` creates an editable walk-in profile and queues it. Retries with the same name (ignoring case and repeated spaces) reuse that endpoint-created profile and return 409 while queued or on a track. Later registrations reuse saved edits. Same-name guests sent through this endpoint share an identity; use manual walk-in registration to distinguish different people with identical names. Unknown `uid` / `rfid` values still require a pairing or known student roll; they never create a guest.

Responses: 201 registered (student or guest details, queue position and total waiting); 409 already queued/active or registration rejected; 400 invalid JSON/identifier; 401 invalid key; 422 unknown/unpaired card; 503 unavailable configuration or database. OPTIONS preflight supports Content-Type and x-api-key. GET on either alias returns non-secret contract metadata and does not register anyone.

Open **Endpoint information** in the top navigation (or visit `/endpoints`) for auto-detected host/endpoint URLs, copy controls, a cURL template and an authenticated live tester. The tester asks the organizer to enter the key; it never fetches or embeds the server secret. Physical devices must use the deployed domain or the event server's reachable LAN IP. `127.0.0.1` on an ESP32 refers to the ESP32, not the laptop.

The existing `/api/webhook/rfid` remains compatible with previous optional Bearer-token integrations and also accepts x-api-key. The new primary/fallback paths always require x-api-key.

## Deploy the Next.js application to Vercel

The website and every backend endpoint are implemented in the Next.js App Router (`app/` and `app/api/`). No Express server, Python web server, or separate API deployment is needed. `vercel.json` selects Next.js and the Mumbai function region; `package.json` selects Node.js 24. All database route handlers use the Node.js runtime with a 30-second request duration.

1. Import this GitHub repository as a Vercel project. Select **Next.js**, repository root `.`, and keep the detected install/build/output settings. Vercel runs the existing `npm run build`.
Push the updated code before importing or redeploying the project.

2. Set environment variables for Production and any Preview environments you use:
   - `MONGODB_URI`: the Atlas connection string.
   - `MONGODB_DB_NAME`: `sk-leaderboard` for the existing data. Use a separate database for preview/test deployments to avoid editing the live event.
   - `RFID_API_KEY`: the key shared with the embedded team.
   - `INTEGRATION_TOKEN`: the server-to-server tracker token, if enabled.
   - Optional `MONGODB_MAX_POOL_SIZE`: defaults to 10 per worker.
3. Ensure Atlas Network Access permits the deployed Vercel application's outbound connections. The laptop's allowed IP does not automatically authorize Vercel.
4. Deploy. Open `/api/health`: HTTP 200 with `database: connected` confirms database readiness. A missing/unavailable database returns HTTP 503. Do not use an in-memory demo store for an event deployment.
5. Give the embedded team `https://YOUR_DOMAIN/api/arcade/scan` (fallback `/api/rfid/scan`) plus the configured API key. The API details panel automatically uses the deployed domain.
6. For tracking, run the optional local bridge with `npm run tracker:bridge -- --origin https://YOUR_DOMAIN` and provide the same integration token to the bridge process. The camera/serial reader stays on the physical event computer; it sends HTTP events to the deployed Next.js APIs. The bridge is a local device adapter, not a second hosted web backend.

Imported contacts are already in MongoDB. Vercel runtime code never needs the private local `contacts.json`, a local filesystem write, or a permanently running timer process. `.vercelignore` excludes contact input files, local environment files, tests and hardware/import utilities from deployment uploads. Next.js output tracing excludes them from API function dependencies too.

Race clocks use saved timestamps; race and lap state loads from MongoDB on every mutation. Database transactions protect shared state across Vercel workers; process-global values are connection caches and local request coordination, not the source of persistent race data. Database failures do not become successful in-memory writes, and failed connection attempts can retry on a later request. `npm run test:vercel:smoke` runs the production server in simulated Vercel mode without local contacts or database credentials and verifies clear configuration errors. Run it after building. `npm run test:vercel` checks independent-worker recovery and absence of local contacts dependencies using a simulated MongoDB backend; the real-database suites are still required for live integration verification.

This prepares the repository for deployment; it does not create a Vercel project, publish a deployment, or configure organizer authentication. Those require the hosting/account setup described above.

The header reports **Database unavailable** after a failed connection rather than staying on Connecting. Refreshes do not overlap, connection requests have a timeout, and **Retry connection** retries without clearing the last displayed race state. `npm run test:connection-status` checks slow failure and recovery in Chrome against the running preview using intercepted responses; it does not change database records.

### Single-lap leaderboard

Standings rank each participant by their fastest valid completed lap across all attempts. A lap counts immediately after it is saved, including during a running race and when the race is later unfinished, withdrawn, or disqualified. Players without a completed lap are not ranked. The leaderboard combines the durable `lap_records` ledger with older archived round laps, deduplicating by race, participant and lap number. It shows unique completed-lap and race counts; race totals and penalties are not single-lap times. Search preserves overall ranks and the top-three podium.
