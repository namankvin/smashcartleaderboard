import { MongoClient, Db } from "mongodb";
import { Student, QueueItem, ActivePlayer, MatchRound, DbStatus, WithdrawnRecord, LeaderboardEntry } from "./types";
import { SAMPLE_STUDENTS, SAMPLE_MATCH_HISTORY } from "./sampleData";

// Global cache for Next.js hot-reloads and serverless
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _roboStore: {
    students: Student[];
    queue: QueueItem[];
    activePlayers: ActivePlayer[];
    roundNumber: number;
    history: MatchRound[];
    withdrawn: WithdrawnRecord[];
  } | undefined;
}

// In-Memory Fallback Store (for immediate testing without MongoDB)
function getMockStore() {
  if (!globalThis._roboStore) {
    globalThis._roboStore = {
      students: [...SAMPLE_STUDENTS],
      queue: [
        {
          id: "queue_init_1",
          rollNo: "24ROB101",
          name: "Aarav Sharma",
          teamName: "Mecha Titans",
          department: "Robotics & Automation",
          enqueuedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
          status: "waiting",
        },
        {
          id: "queue_init_2",
          rollNo: "24ROB102",
          name: "Diya Patel",
          teamName: "Cyber Hawks",
          department: "Robotics & Automation",
          enqueuedAt: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
          status: "waiting",
        },
        {
          id: "queue_init_3",
          rollNo: "24EC205",
          name: "Rohan Verma",
          teamName: "Circuit Breakers",
          department: "Electronics & Comm",
          enqueuedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
          status: "waiting",
        },
        {
          id: "queue_init_4",
          rollNo: "24CS312",
          name: "Ananya Iyer",
          teamName: "Neural Sparks",
          department: "Computer Science",
          enqueuedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
          status: "waiting",
        },
      ],
      activePlayers: [
        {
          slot: 1,
          rollNo: "",
          name: "Vacant Slot",
          teamName: "Standby",
          department: "",
          startTime: null,
          stopTime: null,
          accumulatedMs: 0,
          isRunning: false,
          status: "vacant",
          isVacant: true,
        },
        {
          slot: 2,
          rollNo: "",
          name: "Vacant Slot",
          teamName: "Standby",
          department: "",
          startTime: null,
          stopTime: null,
          accumulatedMs: 0,
          isRunning: false,
          status: "vacant",
          isVacant: true,
        },
        {
          slot: 3,
          rollNo: "",
          name: "Vacant Slot",
          teamName: "Standby",
          department: "",
          startTime: null,
          stopTime: null,
          accumulatedMs: 0,
          isRunning: false,
          status: "vacant",
          isVacant: true,
        },
      ],
      roundNumber: 3,
      history: [...SAMPLE_MATCH_HISTORY],
      withdrawn: [],
    };
  }
  return globalThis._roboStore;
}

const uri = process.env.MONGODB_URI;
let clientPromise: Promise<MongoClient> | null = null;
let isMongoConfigured = false;

if (uri && uri.trim().startsWith("mongodb")) {
  isMongoConfigured = true;
  if (!globalThis._mongoClientPromise) {
    const client = new MongoClient(uri);
    globalThis._mongoClientPromise = client.connect();
  }
  clientPromise = globalThis._mongoClientPromise;
}

async function getMongoDb(): Promise<Db | null> {
  if (!clientPromise) return null;
  try {
    const client = await clientPromise;
    return client.db(process.env.MONGODB_DB_NAME || "robotics_db");
  } catch (err) {
    console.warn("MongoDB connection failed, falling back to mock database:", err);
    return null;
  }
}

// ----------------- DATABASE REPOSITORY METHODS -----------------

export async function getDbStatus(): Promise<DbStatus> {
  const db = await getMongoDb();
  if (db) {
    try {
      const studentCount = await db.collection("students").countDocuments();
      const queueCount = await db.collection("queue").countDocuments();
      return {
        connectedToMongo: true,
        mongoUriConfigured: true,
        source: "mongodb",
        totalStudents: studentCount,
        totalInQueue: queueCount,
        activeRound: 1,
      };
    } catch {
      // Fall through to mock
    }
  }

  const store = getMockStore();
  return {
    connectedToMongo: false,
    mongoUriConfigured: isMongoConfigured,
    source: "mock-in-memory",
    totalStudents: store.students.length,
    totalInQueue: store.queue.length,
    activeRound: store.roundNumber,
  };
}

// Students
export async function getAllStudents(search?: string): Promise<Student[]> {
  const db = await getMongoDb();
  if (db) {
    try {
      const filter: Record<string, unknown> = {};
      if (search) {
        const regex = new RegExp(search.trim(), "i");
        filter.$or = [{ rollNo: regex }, { name: regex }, { teamName: regex }];
      }
      const docs = await db.collection<Student>("students").find(filter).toArray();
      if (docs.length > 0) return docs;
    } catch (err) {
      console.warn("Mongo query failed, using mock", err);
    }
  }

  const store = getMockStore();
  if (!search) return store.students;
  const q = search.trim().toLowerCase();
  return store.students.filter(
    (s) =>
      s.rollNo.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.teamName && s.teamName.toLowerCase().includes(q))
  );
}

export async function findStudentByRollNo(rollNo: string): Promise<Student | null> {
  const cleanRoll = rollNo.trim().toUpperCase();
  const db = await getMongoDb();
  if (db) {
    try {
      const student = await db.collection<Student>("students").findOne({
        rollNo: { $regex: new RegExp(`^${cleanRoll}$`, "i") },
      });
      if (student) return student;
    } catch (err) {
      console.warn("Mongo find student failed, using mock", err);
    }
  }

  const store = getMockStore();
  const match = store.students.find(
    (s) => s.rollNo.trim().toUpperCase() === cleanRoll
  );
  return match || null;
}

export async function insertStudent(student: Student): Promise<Student> {
  const cleanStudent: Student = {
    ...student,
    rollNo: student.rollNo.trim().toUpperCase(),
    registeredAt: new Date().toISOString(),
  };

  const db = await getMongoDb();
  if (db) {
    try {
      await db.collection("students").updateOne(
        { rollNo: cleanStudent.rollNo },
        { $set: cleanStudent },
        { upsert: true }
      );
      return cleanStudent;
    } catch (err) {
      console.warn("Mongo insert student failed, saving in mock", err);
    }
  }

  const store = getMockStore();
  const idx = store.students.findIndex(
    (s) => s.rollNo.toUpperCase() === cleanStudent.rollNo
  );
  if (idx >= 0) {
    store.students[idx] = cleanStudent;
  } else {
    store.students.push(cleanStudent);
  }
  return cleanStudent;
}

export async function bulkInsertStudents(students: Student[]): Promise<{ count: number }> {
  let count = 0;
  for (const s of students) {
    if (s.rollNo && s.name) {
      await insertStudent(s);
      count++;
    }
  }
  return { count };
}

// ----------------- QUEUE METHODS -----------------

export async function getQueue(): Promise<QueueItem[]> {
  const db = await getMongoDb();
  if (db) {
    try {
      return await db
        .collection<QueueItem>("queue")
        .find({ status: "waiting" })
        .sort({ enqueuedAt: 1 })
        .toArray();
    } catch (err) {
      console.warn("Mongo get queue failed, using mock", err);
    }
  }

  const store = getMockStore();
  return store.queue.filter((q) => q.status === "waiting");
}

export async function addToQueueByRollNo(
  rollNo: string,
  extraName?: string
): Promise<{ success: boolean; item?: QueueItem; message: string; isNewStudent?: boolean; isBarred?: boolean }> {
  const cleanRoll = rollNo.trim().toUpperCase();
  const store = getMockStore();

  // Check if student was barred from next round because they changed mind / left arena
  const barredRecord = store.withdrawn.find(
    (w) => w.rollNo.toUpperCase() === cleanRoll && w.barredFromNextRound
  );
  if (barredRecord) {
    return {
      success: false,
      message: `Roll No ${cleanRoll} (${barredRecord.name}) withdrew/changed mind from Lane #${barredRecord.slot} and is BARRED from playing the next round.`,
      isBarred: true,
    };
  }

  // Check if student already in queue
  const currentQueue = await getQueue();
  const existingQueueItem = currentQueue.find(
    (q) => q.rollNo.toUpperCase() === cleanRoll && q.status === "waiting"
  );
  if (existingQueueItem) {
    return {
      success: false,
      item: existingQueueItem,
      message: `Roll No ${cleanRoll} is already in the queue at position #${
        currentQueue.indexOf(existingQueueItem) + 1
      }!`,
    };
  }

  // Check if currently sitting in an active arena lane
  const inArena = store.activePlayers.find(
    (p) => !p.isVacant && p.rollNo.toUpperCase() === cleanRoll
  );
  if (inArena) {
    return {
      success: false,
      message: `Roll No ${cleanRoll} is currently seated in active Arena Lane #${inArena.slot}!`,
    };
  }

  // Lookup student from DB
  let student = await findStudentByRollNo(cleanRoll);
  let isNew = false;

  if (!student) {
    // If not in DB, create on-the-fly record
    student = {
      rollNo: cleanRoll,
      name: extraName?.trim() || `Contestant ${cleanRoll}`,
      teamName: "Independent Bot",
      department: "Engineering",
      year: "2026",
      registeredAt: new Date().toISOString(),
    };
    await insertStudent(student);
    isNew = true;
  }

  const queueItem: QueueItem = {
    id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    rollNo: student.rollNo,
    name: student.name,
    teamName: student.teamName || "Bot Racer",
    department: student.department || "Robotics",
    enqueuedAt: new Date().toISOString(),
    status: "waiting",
  };

  const db = await getMongoDb();
  if (db) {
    try {
      await db.collection("queue").insertOne(queueItem);
      return {
        success: true,
        item: queueItem,
        message: `Added ${student.name} (${cleanRoll}) to queue successfully!`,
        isNewStudent: isNew,
      };
    } catch (err) {
      console.warn("Mongo insert queue failed, using mock", err);
    }
  }

  store.queue.push(queueItem);
  return {
    success: true,
    item: queueItem,
    message: `Added ${student.name} (${cleanRoll}) to queue successfully!`,
    isNewStudent: isNew,
  };
}

export async function removeFromQueue(idOrRoll: string): Promise<boolean> {
  const store = getMockStore();
  const clean = idOrRoll.trim().toUpperCase();

  const db = await getMongoDb();
  if (db) {
    try {
      await db.collection("queue").deleteOne({
        $or: [{ id: idOrRoll }, { rollNo: clean }],
      });
    } catch (err) {
      console.warn("Mongo remove queue failed", err);
    }
  }

  const initialLen = store.queue.length;
  store.queue = store.queue.filter(
    (q) => q.id !== idOrRoll && q.rollNo.toUpperCase() !== clean
  );
  return store.queue.length < initialLen;
}

export async function clearQueue(): Promise<boolean> {
  const db = await getMongoDb();
  if (db) {
    try {
      await db.collection("queue").deleteMany({});
      return true;
    } catch {
      // Ignore
    }
  }

  const store = getMockStore();
  store.queue = [];
  return true;
}

// ----------------- ACTIVE ARENA & SLOTS MANAGEMENT -----------------

function ensureThreeSlots(players: ActivePlayer[]): ActivePlayer[] {
  const result: ActivePlayer[] = [];
  for (let slot = 1; slot <= 3; slot++) {
    const existing = players.find((p) => p.slot === slot);
    if (existing) {
      result.push(existing);
    } else {
      result.push({
        slot,
        rollNo: "",
        name: "Vacant Slot",
        teamName: "Standby",
        department: "",
        startTime: null,
        stopTime: null,
        accumulatedMs: 0,
        isRunning: false,
        status: "vacant",
        isVacant: true,
      });
    }
  }
  return result;
}

export async function getActiveArena(): Promise<{
  players: ActivePlayer[];
  roundNumber: number;
  history: MatchRound[];
  withdrawn: WithdrawnRecord[];
}> {
  const store = getMockStore();
  store.activePlayers = ensureThreeSlots(store.activePlayers);
  return {
    players: store.activePlayers,
    roundNumber: store.roundNumber,
    history: store.history,
    withdrawn: store.withdrawn || [],
  };
}

export async function startNextThreeInArena(): Promise<{
  success: boolean;
  players: ActivePlayer[];
  message: string;
}> {
  const store = getMockStore();
  const queue = await getQueue();

  if (queue.length === 0) {
    return {
      success: false,
      players: ensureThreeSlots(store.activePlayers),
      message: "The queue is empty! Add contestants before starting the game.",
    };
  }

  // Pull up to 3 players from queue
  const selectedQueueItems = queue.slice(0, 3);
  const selectedIds = new Set(selectedQueueItems.map((q) => q.id));

  // Remove selected items from queue
  store.queue = store.queue.filter((q) => !selectedIds.has(q.id));

  // If using Mongo, also update status in MongoDB
  const db = await getMongoDb();
  if (db) {
    try {
      await db.collection("queue").deleteMany({ id: { $in: Array.from(selectedIds) } });
    } catch (err) {
      console.warn("Mongo queue update failed", err);
    }
  }

  // Populate 3 slots
  const newActivePlayers: ActivePlayer[] = [1, 2, 3].map((slotNumber) => {
    const item = selectedQueueItems[slotNumber - 1];
    if (item) {
      return {
        slot: slotNumber,
        queueId: item.id,
        rollNo: item.rollNo,
        name: item.name,
        teamName: item.teamName,
        department: item.department,
        startTime: null,
        stopTime: null,
        accumulatedMs: 0,
        isRunning: false,
        status: "ready",
        penaltySeconds: 0,
        isVacant: false,
      };
    } else {
      return {
        slot: slotNumber,
        rollNo: "",
        name: "Vacant Slot",
        teamName: "Standby",
        department: "",
        startTime: null,
        stopTime: null,
        accumulatedMs: 0,
        isRunning: false,
        status: "vacant",
        isVacant: true,
      };
    }
  });

  store.activePlayers = newActivePlayers;

  return {
    success: true,
    players: newActivePlayers,
    message: `Round #${store.roundNumber} prepared with ${selectedQueueItems.length} active contestant(s)!`,
  };
}

// Vacate a slot (player changes mind / leaves position / organizer removes)
export async function vacateArenaSlot(
  slot: number,
  options: {
    reason?: string;
    sendToQueue?: boolean;
    barFromNextRound?: boolean;
  }
): Promise<{ success: boolean; players: ActivePlayer[]; message: string; vacatedPlayer?: ActivePlayer }> {
  const store = getMockStore();
  store.activePlayers = ensureThreeSlots(store.activePlayers);

  const idx = store.activePlayers.findIndex((p) => p.slot === slot);
  if (idx === -1) {
    return { success: false, players: store.activePlayers, message: `Slot #${slot} not found.` };
  }

  const currentPlayer = store.activePlayers[idx];
  if (currentPlayer.isVacant) {
    return { success: false, players: store.activePlayers, message: `Slot #${slot} is already vacant.` };
  }

  // 1. If barred from next round (changed mind / left position)
  if (options.barFromNextRound && currentPlayer.rollNo) {
    const withdrawnRecord: WithdrawnRecord = {
      rollNo: currentPlayer.rollNo,
      name: currentPlayer.name,
      teamName: currentPlayer.teamName,
      slot: currentPlayer.slot,
      withdrawnAt: new Date().toISOString(),
      roundNumber: store.roundNumber,
      reason: options.reason || "Changed mind / left arena position",
      barredFromNextRound: true,
    };
    store.withdrawn.push(withdrawnRecord);
  }

  // 2. If organizer wants to return them to queue
  if (options.sendToQueue && currentPlayer.rollNo && !options.barFromNextRound) {
    await addToQueueByRollNo(currentPlayer.rollNo, currentPlayer.name);
  }

  // 3. Mark the slot as vacant
  store.activePlayers[idx] = {
    slot,
    rollNo: "",
    name: "Vacant Slot",
    teamName: "Standby",
    department: "",
    startTime: null,
    stopTime: null,
    accumulatedMs: 0,
    isRunning: false,
    status: "vacant",
    isVacant: true,
  };

  const statusNote = options.barFromNextRound
    ? `(${currentPlayer.name} changed mind & will NOT play in next round)`
    : options.sendToQueue
    ? `(returned to waiting queue)`
    : `(vacated)`;

  return {
    success: true,
    players: store.activePlayers,
    message: `Lane #${slot} is now VACANT ${statusNote}.`,
    vacatedPlayer: currentPlayer,
  };
}

// Assign a player into a specific arena slot (either from waiting queue or manual DB roll lookup)
export async function assignPlayerToArenaSlot(
  slot: number,
  rollNo: string,
  options?: { overrideBar?: boolean; fromQueueId?: string }
): Promise<{ success: boolean; players: ActivePlayer[]; message: string; player?: ActivePlayer }> {
  const store = getMockStore();
  store.activePlayers = ensureThreeSlots(store.activePlayers);

  const cleanRoll = rollNo.trim().toUpperCase();

  // Check if barred from round
  const barredRecord = store.withdrawn.find(
    (w) => w.rollNo.toUpperCase() === cleanRoll && w.barredFromNextRound
  );
  if (barredRecord && !options?.overrideBar) {
    return {
      success: false,
      players: store.activePlayers,
      message: `Roll #${cleanRoll} (${barredRecord.name}) withdrew/changed mind earlier and is BARRED from this round!`,
    };
  }

  // Check if player is already in another arena slot
  const alreadyInSlot = store.activePlayers.find(
    (p) => !p.isVacant && p.slot !== slot && p.rollNo.toUpperCase() === cleanRoll
  );
  if (alreadyInSlot) {
    return {
      success: false,
      players: store.activePlayers,
      message: `Roll #${cleanRoll} is already active in Lane #${alreadyInSlot.slot}!`,
    };
  }

  // Find student in DB or existing queue
  let student = await findStudentByRollNo(cleanRoll);
  const queueItem = store.queue.find((q) => q.rollNo.toUpperCase() === cleanRoll);

  if (!student && queueItem) {
    student = {
      rollNo: queueItem.rollNo,
      name: queueItem.name,
      teamName: queueItem.teamName,
      department: queueItem.department,
    };
  } else if (!student) {
    student = {
      rollNo: cleanRoll,
      name: `Contestant ${cleanRoll}`,
      teamName: "Selected Racer",
      department: "Robotics",
    };
    await insertStudent(student);
  }

  // Remove from waiting queue if they were in the queue
  await removeFromQueue(cleanRoll);

  // Seat the player in the slot
  const newPlayer: ActivePlayer = {
    slot,
    queueId: queueItem?.id || `direct_${Date.now()}`,
    rollNo: student.rollNo,
    name: student.name,
    teamName: student.teamName || "Arena Racer",
    department: student.department || "Robotics",
    startTime: null,
    stopTime: null,
    accumulatedMs: 0,
    isRunning: false,
    status: "ready",
    penaltySeconds: 0,
    isVacant: false,
  };

  const idx = store.activePlayers.findIndex((p) => p.slot === slot);
  if (idx !== -1) {
    store.activePlayers[idx] = newPlayer;
  } else {
    store.activePlayers.push(newPlayer);
  }

  return {
    success: true,
    players: store.activePlayers,
    message: `Assigned ${student.name} (${student.rollNo}) to Lane #${slot} successfully!`,
    player: newPlayer,
  };
}

// Edit player details in a slot (typo fix, team update)
export async function editArenaPlayer(
  slot: number,
  data: { name?: string; teamName?: string; rollNo?: string; department?: string }
): Promise<{ success: boolean; players: ActivePlayer[]; message: string }> {
  const store = getMockStore();
  store.activePlayers = ensureThreeSlots(store.activePlayers);

  const player = store.activePlayers.find((p) => p.slot === slot);
  if (!player || player.isVacant) {
    return { success: false, players: store.activePlayers, message: `No active player in Lane #${slot} to edit.` };
  }

  if (data.name) player.name = data.name.trim();
  if (data.teamName) player.teamName = data.teamName.trim();
  if (data.department) player.department = data.department.trim();
  if (data.rollNo) player.rollNo = data.rollNo.trim().toUpperCase();

  return {
    success: true,
    players: store.activePlayers,
    message: `Updated Lane #${slot} details successfully!`,
  };
}

// Un-bar a withdrawn contestant
export async function unbarContestant(rollNo: string): Promise<boolean> {
  const store = getMockStore();
  const clean = rollNo.trim().toUpperCase();
  const initial = store.withdrawn.length;
  store.withdrawn = store.withdrawn.filter((w) => w.rollNo.toUpperCase() !== clean);
  return store.withdrawn.length < initial;
}

// Timer actions
export async function updateArenaPlayer(
  slot: number,
  action: "start" | "stop" | "reset" | "penalty" | "disqualify",
  extra?: { penalty?: number }
): Promise<ActivePlayer[]> {
  const store = getMockStore();
  const player = store.activePlayers.find((p) => p.slot === slot);
  if (!player || player.isVacant) return store.activePlayers;

  const now = Date.now();

  switch (action) {
    case "start":
      if (!player.isRunning && player.status !== "disqualified") {
        player.startTime = now;
        player.isRunning = true;
        player.status = "running";
      }
      break;
    case "stop":
      if (player.isRunning && player.startTime) {
        player.accumulatedMs += now - player.startTime;
        player.startTime = null;
        player.stopTime = now;
        player.isRunning = false;
        player.status = "finished";
      }
      break;
    case "reset":
      player.startTime = null;
      player.stopTime = null;
      player.accumulatedMs = 0;
      player.isRunning = false;
      player.status = "ready";
      player.penaltySeconds = 0;
      break;
    case "penalty":
      player.penaltySeconds = (player.penaltySeconds || 0) + (extra?.penalty || 5);
      break;
    case "disqualify":
      player.isRunning = false;
      player.startTime = null;
      player.status = "disqualified";
      break;
  }

  return store.activePlayers;
}

export async function updateArenaAll(
  action: "start_all" | "stop_all" | "reset_all"
): Promise<ActivePlayer[]> {
  const store = getMockStore();
  const now = Date.now();

  store.activePlayers.forEach((player) => {
    if (player.isVacant || player.status === "disqualified") return;

    if (action === "start_all") {
      if (!player.isRunning && player.status !== "finished") {
        player.startTime = now;
        player.isRunning = true;
        player.status = "running";
      }
    } else if (action === "stop_all") {
      if (player.isRunning && player.startTime) {
        player.accumulatedMs += now - player.startTime;
        player.startTime = null;
        player.stopTime = now;
        player.isRunning = false;
        player.status = "finished";
      }
    } else if (action === "reset_all") {
      player.startTime = null;
      player.stopTime = null;
      player.accumulatedMs = 0;
      player.isRunning = false;
      player.status = "ready";
    }
  });

  return store.activePlayers;
}

export async function finishRound(): Promise<{
  round: MatchRound;
  allHistory: MatchRound[];
} | null> {
  const store = getMockStore();
  const validPlayers = store.activePlayers.filter((p) => !p.isVacant);
  if (validPlayers.length === 0) return null;

  // Format milliseconds into MM:SS.mmm
  const formatTime = (ms: number, penaltySec = 0) => {
    const totalMs = ms + penaltySec * 1000;
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const millis = Math.floor(totalMs % 1000);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(
      millis
    ).padStart(3, "0")}`;
  };

  const completedRound: MatchRound = {
    id: `round_${store.roundNumber}_${Date.now()}`,
    roundNumber: store.roundNumber,
    completedAt: new Date().toISOString(),
    players: validPlayers.map((p) => {
      let finalMs = p.accumulatedMs;
      if (p.isRunning && p.startTime) {
        finalMs += Date.now() - p.startTime;
      }
      return {
        slot: p.slot,
        rollNo: p.rollNo,
        name: p.name,
        teamName: p.teamName,
        timeMs: finalMs + (p.penaltySeconds || 0) * 1000,
        timeFormatted: formatTime(finalMs, p.penaltySeconds || 0),
        status: p.status,
        penalties: p.penaltySeconds,
      };
    }),
  };

  store.history.unshift(completedRound);
  store.roundNumber += 1;
  // Reset arena to 3 vacant slots
  store.activePlayers = ensureThreeSlots([]);

  // Clear barred status for next round if organizer only intended 1-round ban
  // or keep it so organizer can manage
  const db = await getMongoDb();
  if (db) {
    try {
      await db.collection("rounds").insertOne(completedRound);
    } catch {
      // Ignore
    }
  }

  return { round: completedRound, allHistory: store.history };
}

// ----------------- OVERALL LEADERBOARD AGGREGATION -----------------

export async function getLeaderboardData(searchRollNo?: string): Promise<{
  totalParticipantsCount: number;
  topThree: LeaderboardEntry[];
  allParticipants: LeaderboardEntry[];
}> {
  const store = getMockStore();
  let historyRounds = store.history;

  const db = await getMongoDb();
  if (db) {
    try {
      const docs = await db.collection<MatchRound>("rounds").find().sort({ completedAt: -1 }).toArray();
      if (docs.length > 0) {
        historyRounds = docs;
      }
    } catch {
      // Use mock store
    }
  }

  // Aggregate by unique student roll number
  const participantsMap = new Map<
    string,
    {
      rollNo: string;
      name: string;
      teamName?: string;
      department?: string;
      bestTimeMs: number;
      bestTimeFormatted: string;
      roundsPlayed: number;
      status: string;
      penalties: number;
      lastPlayedAt: string;
    }
  >();

  for (const round of historyRounds) {
    for (const p of round.players) {
      if (!p.rollNo) continue;
      const cleanRoll = p.rollNo.toUpperCase();
      const existing = participantsMap.get(cleanRoll);

      if (!existing) {
        participantsMap.set(cleanRoll, {
          rollNo: p.rollNo,
          name: p.name,
          teamName: p.teamName,
          bestTimeMs: p.timeMs,
          bestTimeFormatted: p.timeFormatted,
          roundsPlayed: 1,
          status: p.status,
          penalties: p.penalties || 0,
          lastPlayedAt: round.completedAt,
        });
      } else {
        existing.roundsPlayed += 1;
        // Keep fastest (lowest time in ms)
        if (
          p.status !== "disqualified" &&
          (existing.status === "disqualified" || p.timeMs < existing.bestTimeMs)
        ) {
          existing.bestTimeMs = p.timeMs;
          existing.bestTimeFormatted = p.timeFormatted;
          existing.status = p.status;
          existing.penalties = p.penalties || 0;
        }
      }
    }
  }

  // Sort: non-disqualified lowest time first, then disqualified at the bottom
  const sorted = Array.from(participantsMap.values()).sort((a, b) => {
    if (a.status === "disqualified" && b.status !== "disqualified") return 1;
    if (b.status === "disqualified" && a.status !== "disqualified") return -1;
    return a.bestTimeMs - b.bestTimeMs;
  });

  // Assign ranks
  const ranked: LeaderboardEntry[] = sorted.map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));

  const totalParticipantsCount = ranked.length;
  const topThree = ranked.slice(0, 3);

  // Filter if searchRollNo is provided
  let filtered = ranked;
  if (searchRollNo && searchRollNo.trim()) {
    const q = searchRollNo.trim().toLowerCase();
    filtered = ranked.filter(
      (r) =>
        r.rollNo.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.teamName && r.teamName.toLowerCase().includes(q))
    );
  }

  return {
    totalParticipantsCount,
    topThree,
    allParticipants: filtered,
  };
}
