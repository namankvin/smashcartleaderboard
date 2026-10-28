# 🤖 ROBO-ARENA // Competition Queue & Master Timer OS

A futuristic, sci-fi robotics competition management system built with **Next.js (App Router)** and **MongoDB**. Designed for real-time robotic arena matches, track races, and hackathon challenges.

> **⚡ Zero-Config Instant Testing**: You **do NOT need a MongoDB database to test**! The app includes an intelligent **In-Memory Mock Database** pre-loaded with realistic robotics student contestants. You can start testing immediately!

---

## 🚀 Key Features

1. **Robotics Cyberpunk Arena HUD Theme**:
   - Dark tech cockpit styling with neon cyan (`#00f0ff`), emerald green (`#10b981`), amber (`#f59e0b`), and rose accents.
   - Digital LCD stopwatches with 60fps high-precision millisecond counters (`MM:SS.mmm`).
   - Integrated Web Audio API sound effects (Arena start buzzer, lap stop chimes, victory fanfare, enqueued beeps).

2. **Main Website Roll No Webhook**:
   - Dedicated webhook endpoint (`POST /api/webhook/roll-no`) to receive student roll numbers from any external website.
   - Automatically queries the Database to retrieve the student's name, team, and department, then adds them to the live waiting queue.
   - Built-in interactive Webhook Tester modal directly inside the web UI.

3. **Organizer Arena Slot Management (Vacate, Fill, Edit, Swap)**:
   - **Contestant Changes Mind / Leaves Position**:
     - Click **"Changed Mind?"** on any lane card.
     - Organizer can choose:
       - **🚫 Changed Mind (Bar from Next Round & Free Seat)**: Tags the player as having left their position, marks them ineligible for the next round, and immediately vacates the lane!
       - **↩ Return to Waiting Queue**: Frees the lane and places them back into the waiting list.
       - **🗑️ Just Vacate Seat**: Frees the lane without re-queueing.
   - **Filling Vacant Seats**:
     - When any seat is vacant (`[LANE #X VACANT]`), the organizer can:
       1. Type a roll number directly in that vacant lane card and click **Seat**.
       2. Click **Seat Here →** next to any contestant in the waiting list.
       3. Type the roll number in the top search box and click **⚡ Fill Vacant Lane #X**.
   - **Editing Player Info**:
     - Click the ✏️ **Edit** icon on any active lane to update student name, team name, or roll number.

4. **Waiting List Management & Deletion**:
   - Real-time search/filter bar to locate any contestant by roll number or name in the waiting list.
   - Delete any roll number from the waiting list with a single click.
   - 1-click **Promote / Seat Now (→ Lane #1, #2, #3)** buttons on waiting list cards when any arena seat is open.

5. **3-Robot Active Playing Arena & Stopwatches**:
   - **"Start Game" Button**: Draws the top 3 persons from the waiting queue and assigns them to Arena Lanes 1, 2, and 3.
   - **Master Synchronized Controls**:
     - `START ALL TIMERS` starts stopwatches for all 3 robots simultaneously.
     - `STOP ALL TIMERS` stops all 3 stopwatches simultaneously.
     - `RESET ALL` resets all 3 stopwatches.
   - **Individual Controls for each of the 3 Lanes**:
     - Individual `START TIME` button.
     - Individual `STOP TIME` button (to record when each robot finishes the course).
     - Individual `RESET` button.
     - `+5s Penalty` obstacle/boundary penalty button.
     - `Disqualify (DQ)` button.
   - **Save & Complete Round**: Records finish times into match archives and clears the arena for the next 3 contestants.

6. **Overall Competition Leaderboard Page (`/leaderboard`)**:
   - **Total Players Count**: Prominent digital HUD display showing only the count of all unique candidates who participated.
   - **Top Three Performers Podium**: Visual gold, silver, and bronze championship cards highlighting the fastest 3 contestants, their names, roll numbers, team names, and best times.
   - **Search by Roll Number Directory**: Dedicated section titled `SEARCH BY ROLL NUMBER // CANDIDATE DIRECTORY` with instant filter by roll number and candidate name.
   - **Comprehensive Standings Table**: Full ranked list of all participants, fastest course times, rounds played, and official verified status.

7. **Students Database & Bulk Importer**:
   - View all registered contestants.
   - Easily import your own student database via JSON array paste or API.

---

## 🛠️ Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```
*(Or run `.\start.ps1` or double-click `start.bat`)*

Open [http://localhost:3000](http://localhost:3000) in your browser. The app will open in **Testing Mode** with sample students ready to test right away!

---

## 📡 Webhook Integration (Receiving Roll No from Main Website)

When a student checks in or scans their badge on your main website, send an HTTP `POST` request to this endpoint.

### Primary Endpoint
```
POST https://<your-deployed-domain>.vercel.app/api/webhook/roll-no
```
*(Alternative alias: `POST /api/queue/enqueue-by-roll`)*

### Request Format
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "rollNo": "24ROB101"
}
```

### Success Response (`201 Created`)
```json
{
  "success": true,
  "message": "Added Aarav Sharma (24ROB101) to queue successfully!",
  "queuePosition": 4,
  "totalInQueue": 4,
  "student": {
    "rollNo": "24ROB101",
    "name": "Aarav Sharma",
    "teamName": "Mecha Titans",
    "department": "Robotics & Automation"
  }
}
```

---

## 🗄️ All Available API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/webhook/roll-no` | **Main website endpoint**: receives roll number, retrieves name from DB, adds to queue |
| `GET` | `/api/queue` | Returns the current waiting queue |
| `POST` | `/api/queue` | Manual add contestant to queue (`{ rollNo, name? }`) |
| `DELETE` | `/api/queue?id=...` | Remove a contestant from queue (`?clearAll=true` to clear all) |
| `POST` | `/api/game/slots` | **Organizer Slot Management**: `vacate`, `assign`, `edit`, `unbar` |
| `GET` | `/api/students` | List all students or search (`?q=...` or `?rollNo=...`) |
| `POST` | `/api/students` | Add single student or bulk import array of students |
| `GET` | `/api/students/[rollNo]` | Get specific student by roll number |
| `GET` | `/api/game` | Get current arena status (3 active players, round #, archives, withdrawn) |
| `POST` | `/api/game/start-next` | Pulls the top 3 persons from queue into active arena |
| `POST` | `/api/game/timer` | Master & individual timer actions (`start_all`, `stop_all`, `start`, `stop`, `reset`) |
| `POST` | `/api/game/finish` | Completes current round and saves recorded times into history |
| `GET` | `/api/system/db-status` | Returns MongoDB vs Mock DB connection state and stats |

---

## 🛢️ Connecting MongoDB (When Ready)

When you create a MongoDB Atlas cluster:
1. Open `.env.local`:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=robotics_db
```
2. Restart Next.js (`npm run dev`).
3. The top header will automatically switch to **🟢 MongoDB Connected**!

---

## 🌐 Deploying to Vercel

1. Push your code to a GitHub repository:
```bash
git init
git add .
git commit -m "Robotics Arena Queue & Master Timer"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository and click **Deploy**.
