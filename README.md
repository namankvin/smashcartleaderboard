# SmashKart event control

Dark-mode organizer dashboard for student/RFID/walk-in registration, reversible three-track preparation, per-player laps, timers and results. The car identities match the Gazebo tracker: **Car 1 Red**, **Car 2 Blue**, **Car 3 Green**.

## Start the website

1. Run `npm ci`.
2. Put the directory at `data/contacts.json` (excluded from Git), or set `CONTACTS_FILE` to its server-side path.
3. Set `MONGODB_URI` and `MONGODB_DB_NAME` in `.env.local`.
4. Run `npm run import:contacts` to upsert the directory. The supplied 9,934 source rows contain 9,933 unique roll numbers. Re-importing does not duplicate students.
5. Run `npm run dev`, or `npm run build` followed by `npm start`. Open http://127.0.0.1:3000.

MongoDB is required for durable event data. With no database configured, the fallback session only lasts for the current process. When MongoDB is configured but unavailable, race mutations fail rather than claiming that timings were saved.

## Registration

- **Student:** enter a roll number to retrieve the student's details and add them to the waiting queue. Unknown roll numbers are rejected.
- **Walk-in / visitor:** only name is required. Email, phone and extras/notes are optional. A generated internal guest ID distinguishes people with identical names. Edit their profile before, during or after racing from the directory, queue, active track or history. Profile edits preserve identity and recorded timing snapshots.
- **RFID:** under setup tools, pair a card UID with a known student roll number. Send scans to `POST /api/webhook/rfid` as `{ "uid": "CARD_UID" }`. Resolved `{ "rollNo": "..." }` registrations also remain supported. Duplicate scans cannot create another waiting entry or register an active player twice.

The physical reader must provide its UID over HTTP (directly or through the team's existing reader service); reading USB/serial hardware is not implemented in the web browser. Pair real cards using the actual reader's UID format before the event.

If `INTEGRATION_TOKEN` is set, RFID scans and telemetry require `Authorization: Bearer <token>`. Keep the token on the reader/bridge server, not in browser code. The browser RFID test tool is intended for local development without this token. Full organizer sign-in is separate deployment work.

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
| `rounds` | Archived rounds used by history and the leaderboard |

View these under the configured database in Atlas Data Explorer. The current database is `sk-leaderboard`. `lap_records` and `race_results` are saved even if the operator has not archived the round yet. There is no winner-only filtering when saving laps.

All arena mutations use MongoDB transactions. The session helper attaches the transaction to existing repository reads/writes, so profile creation, queue transfers, lap inserts and arena updates share one commit. Unique lap keys and ordered lap numbers make retries idempotent.

## Verification

- `npx tsc --noEmit` — type checks.
- `npm run build` — production build.
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
