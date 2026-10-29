import { arenaTransaction, databaseInTransaction } from "./mongoSession";
import { LapRecord, ParticipantSnapshot } from "./types";
import { randomUUID } from "node:crypto";
import { WalkInProfile } from "./types";
import { MongoClient, Db } from "mongodb";
import { Student, QueueItem, ActivePlayer, MatchRound, DbStatus, WithdrawnRecord, LeaderboardEntry } from "./types";
import { getContacts } from "./contacts";
import { TRACK_CARS } from "./cars";

// Global cache for Next.js hot-reloads and serverless
declare global {
  // eslint-disable-next-line no-var
  var _arenaIndexesReady: Promise<unknown> | undefined;
  var _walkInProfiles: Map<string, WalkInProfile> | undefined;
  var _roboStoreVersion: number | undefined;
  var _registrationMutation: Promise<unknown> | undefined;
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _roboStore: {
    students: Student[];
    queue: QueueItem[];
    activePlayers: ActivePlayer[];
    roundNumber: number;
    raceStarted?: boolean;
    raceId?: string;
    targetLaps?: number;
    startedAt?: number;
    history: MatchRound[];
    withdrawn: WithdrawnRecord[];
  } | undefined;
}

// In-Memory Fallback Store (for immediate testing without MongoDB)
function getMockStore() {
  if (requiresMongo && !isMongoConfigured) throw new Error("MONGODB_URI must be configured for hosted deployments.");
  if (!globalThis._roboStore || globalThis._roboStoreVersion !== 2) {
    globalThis._roboStoreVersion = 2;
    globalThis._roboStore = {
      students: isMongoConfigured ? [] : [...getContacts()],
      queue: [],
      activePlayers: [],
      roundNumber: 1,
      raceStarted: false,
      history: [],
      withdrawn: [],
    };
  }
  globalThis._roboStore.raceId ||= randomUUID();
  globalThis._roboStore.targetLaps ||= 3;
  return globalThis._roboStore;
}

const uri = process.env.MONGODB_URI;
const isMongoConfigured = Boolean(uri && uri.trim().startsWith("mongodb"));
const requiresMongo = process.env.VERCEL === "1" || process.env.REQUIRE_MONGODB === "true";

async function getMongoDb(): Promise<Db | null> {
  if (!isMongoConfigured || !uri) {
    if (requiresMongo) throw new Error("MONGODB_URI must be configured for hosted deployments.");
    return null;
  }
  if (!globalThis._mongoClientPromise) {
    const poolSetting = Number(process.env.MONGODB_MAX_POOL_SIZE || 10);
    const maxPoolSize = Number.isInteger(poolSetting) && poolSetting >= 1 && poolSetting <= 50 ? poolSetting : 10;
    const client = new MongoClient(uri, { maxPoolSize, minPoolSize: 0, maxIdleTimeMS: 60000, serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000, waitQueueTimeoutMS: 8000 });
    globalThis._mongoClientPromise = client.connect().catch(async error => {
      await client.close().catch(() => undefined);
      throw error;
    });
  }
  const pending = globalThis._mongoClientPromise;
  try {
    const client = await pending;
    return databaseInTransaction(client.db(process.env.MONGODB_DB_NAME || "robotics_db"));
  } catch {
    // A transient outage must not leave a rejected promise cached for this worker.
    if (globalThis._mongoClientPromise === pending) globalThis._mongoClientPromise = undefined;
    throw new Error("MongoDB is unavailable. Check Atlas network access and connection settings, then retry.");
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
        activeRound: (await readArenaState()).roundNumber || 1,
      };
    } catch (error) {
      if (isMongoConfigured) throw error;
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
      return docs;
    } catch (err) {
      if (isMongoConfigured) throw err;
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
  if (cleanRoll.startsWith("GUEST-")) {
    const guest = await getWalkInProfile(cleanRoll);
    return guest ? { rollNo: guest.id, name: guest.name, email: guest.email } : null;
  }
  const db = await getMongoDb();
  if (db) {
    try {
      const student = await db.collection<Student>("students").findOne({
        rollNo: { $regex: new RegExp(`^${cleanRoll.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      });
      return student;
    } catch (err) {
      if (isMongoConfigured) throw err;
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
      if (isMongoConfigured) throw err;
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
      const queue = await db
        .collection<QueueItem>("queue")
        .find({ status: "waiting" }, { projection: { _id: 0 } })
        .sort({ enqueuedAt: 1 })
        .toArray();
      return hydrateWalkInNames(queue);
    } catch (err) {
      if (isMongoConfigured) throw err;
      console.warn("Mongo get queue failed, using mock", err);
    }
  }

  const store = getMockStore();
  return hydrateWalkInNames(store.queue.filter((q) => q.status === "waiting"));
}

async function addToQueueByRollNoUnlocked(
  rollNo: string,
  _extraName?: string,
  registrationSource: QueueItem["registrationSource"] = "manual"
): Promise<{ success: boolean; item?: QueueItem; message: string; isNewStudent?: boolean; isBarred?: boolean }> {
  if (typeof rollNo !== "string" || !rollNo.trim()) return { success: false, message: "A valid roll number is required." };
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
  const student = await findStudentByRollNo(cleanRoll);
  if (!student) return { success: false, message: `Roll number ${cleanRoll} was not found in the contact directory. Check the roll number before registering.` };
  const isNew = false;

  const queueItem: QueueItem = {
    id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    rollNo: student.rollNo,
    name: student.name,
    teamName: student.teamName,
    department: student.department,
    registrationSource: cleanRoll.startsWith("GUEST-") ? "walk-in" : registrationSource,
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
      if (isMongoConfigured) throw err;
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

async function removeFromQueueUnlocked(idOrRoll: string): Promise<boolean> {
  const store = getMockStore();
  const clean = idOrRoll.trim().toUpperCase();

  const db = await getMongoDb();
  if (db) {
    try {
      const result = await db.collection("queue").deleteOne({
        $or: [{ id: idOrRoll }, { rollNo: clean }],
      });
      store.queue = store.queue.filter(q => q.id !== idOrRoll && q.rollNo !== clean);
      return result.deletedCount > 0;
    } catch (err) {
      if (isMongoConfigured) throw err;
      console.warn("Mongo remove queue failed", err);
    }
  }

  const initialLen = store.queue.length;
  store.queue = store.queue.filter(
    (q) => q.id !== idOrRoll && q.rollNo.toUpperCase() !== clean
  );
  return store.queue.length < initialLen;
}

async function clearQueueUnlocked(): Promise<boolean> {
  const queue = await getQueue();
  for (const item of queue) await removeWaitingParticipantUnlocked(item.id);
  return true;
}

// Explicit waiting-list removal is different from assigning someone to a track.
// Keep the internal removeFromQueue helper free of profile-deletion side effects.
async function removeWaitingParticipantUnlocked(idOrRoll: string): Promise<{
  success: boolean; profileDeleted: boolean; message: string;
}> {
  const store = getMockStore();
  const db = await getMongoDb();
  if (isMongoConfigured && !db) throw new Error("Database unavailable. The participant has not been removed; please retry.");
  const filter = { $or: [{ id: idOrRoll }, { rollNo: idOrRoll.trim().toUpperCase() }] };
  const missing = { success: false, profileDeleted: false, message: "This player is no longer in the waiting queue." };
  const hasLocalResultOrTrack = (rollNo: string) => store.activePlayers.some(player => !player.isVacant && player.rollNo === rollNo) || store.history.some(round => round.players.some(player => player.rollNo === rollNo));
  let removedRoll: string | undefined;
  let result;
  if (db) {
    const session = arenaTransaction.getStore();
    result = await (async () => {
      const item = await db.collection<QueueItem>("queue").findOne(filter, { session });
      if (!item) return missing;
      let profileDeleted = false;
      if (item.rollNo.startsWith("GUEST-") && !hasLocalResultOrTrack(item.rollNo)) {
        // Any saved race entry protects the profile, including disqualifications.
        const recorded = await db.collection("rounds").findOne({ "players.rollNo": item.rollNo }, { session, projection: { _id: 1 } });
        const lap = await db.collection("lap_records").findOne({ rollNo: item.rollNo }, { session, projection: { _id: 1 } });
        if (!recorded && !lap) profileDeleted = (await db.collection("walk_ins").deleteOne({ id: item.rollNo }, { session })).deletedCount > 0;
      }
      await db.collection("queue").deleteOne({ id: item.id }, { session });
      removedRoll = item.rollNo;
      return { success: true, profileDeleted, message: profileDeleted ? "Removed from the waiting queue and deleted the walk-in profile (no saved race results)." : "Removed from the waiting queue. Their profile and any saved results have been kept." };
    })();
  } else {
    const item = store.queue.find(item => item.id === idOrRoll || item.rollNo === idOrRoll.trim().toUpperCase());
    if (!item) return missing;
    const profileDeleted = item.rollNo.startsWith("GUEST-") && !hasLocalResultOrTrack(item.rollNo) ? localWalkIns().delete(item.rollNo) : false;
    removedRoll = item.rollNo;
    result = { success: true, profileDeleted, message: profileDeleted ? "Removed from the waiting queue and deleted the walk-in profile (no saved race results)." : "Removed from the waiting queue. Their profile and any saved results have been kept." };
  }
  if (removedRoll) store.queue = store.queue.filter(item => item.rollNo !== removedRoll);
  return result || missing;
}

export function removeWaitingParticipant(idOrRoll: string) {
  return serializeMutation(() => removeWaitingParticipantUnlocked(idOrRoll));
}

// ----------------- ACTIVE ARENA & SLOTS MANAGEMENT -----------------

function ensureThreeSlots(players: ActivePlayer[]): ActivePlayer[] {
  const result: ActivePlayer[] = [];
  for (let slot = 1; slot <= 3; slot++) {
    const existing = players.find((p) => p.slot === slot);
    if (existing) {
      result.push({ ...existing, carId: TRACK_CARS[slot - 1] });
    } else {
      result.push({
        slot,
        carId: TRACK_CARS[slot - 1],
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
  raceStarted: boolean;
  raceId: string;
  targetLaps: number;
  startedAt?: number;
  history: MatchRound[];
  withdrawn: WithdrawnRecord[];
}> {
  if (!arenaTransaction.getStore()) await globalThis._registrationMutation;
  const store = { ...getMockStore(), ...await readArenaState() };
  store.activePlayers = await hydrateWalkInNames(ensureThreeSlots(store.activePlayers));
  const db = await getMongoDb();
  const history = db ? await db.collection<MatchRound>("rounds").find().sort({ completedAt: -1 }).toArray() : store.history;
  const allPlayers = await hydrateWalkInNames(history.flatMap(round => round.players));
  const names = new Map(allPlayers.map(player => [player.rollNo, player.name]));
  return {
    players: store.activePlayers,
    roundNumber: store.roundNumber,
    raceStarted: Boolean(store.raceStarted),
    raceId: store.raceId!,
    targetLaps: store.targetLaps!,
    startedAt: store.startedAt,
    history: history.map(round => ({ ...round, players: round.players.map(player => ({ ...player, name: names.get(player.rollNo) || player.name })) })),
    withdrawn: await hydrateWalkInNames(store.withdrawn || []),
  };
}

async function startNextThreeInArenaUnlocked(queueIds: unknown): Promise<{
  success: boolean; players: ActivePlayer[]; message: string;
}> {
  const store = getMockStore();
  const players = ensureThreeSlots(store.activePlayers);
  const fail = (message: string) => ({ success: false, players, message });
  if (!Array.isArray(queueIds) || queueIds.length !== 3 || queueIds.some(id => typeof id !== "string") || new Set(queueIds).size !== 3) {
    return fail("Select exactly three different waiting players, in Red, Blue, Green car order.");
  }
  if (store.raceStarted) return fail("Finish the current race before setting up another group.");
  if (players.some(player => !player.isVacant)) return fail("Complete or vacate the current track before assigning another group.");
  const queue = await getQueue();
  const selected = queueIds.map(id => queue.find(item => item.id === id));
  if (selected.some(item => !item)) return fail("One of the selected players is no longer waiting. Refresh and select again.");
  if (selected.some(item => store.withdrawn.some(w => w.rollNo === item!.rollNo && w.barredFromNextRound))) return fail("A selected player is barred from this round.");
  const newPlayers: ActivePlayer[] = selected.map((item, index) => ({
    slot: index + 1, carId: TRACK_CARS[index], queueId: item!.id, queueEntry: item!,
    rollNo: item!.rollNo, name: item!.name, teamName: item!.teamName, department: item!.department,
    startTime: null, stopTime: null, accumulatedMs: 0, isRunning: false,
    status: "ready", penaltySeconds: 0, isVacant: false,
  }));
  const db = await getMongoDb();
  if (db) await db.collection("queue").deleteMany({ id: { $in: queueIds } });
  store.queue = store.queue.filter(item => !queueIds.includes(item.id));
  store.activePlayers = newPlayers;
  return { success: true, players: newPlayers, message: "Selected players assigned to Red, Blue and Green cars. Start timers when ready." };
}

// Vacate a slot (player changes mind / leaves position / organizer removes)
async function vacateArenaSlotUnlocked(
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

  if (options.sendToQueue) {
    if (store.raceStarted) return { success: false, players: store.activePlayers, message: "The race has already started. Finish the round before returning players to the queue." };
    if (options.barFromNextRound) return { success: false, players: store.activePlayers, message: "Choose return to queue or withdrawal, not both." };
    await restoreQueueEntries([currentPlayer]);
    store.activePlayers[idx] = ensureThreeSlots([])[slot - 1];
    return { success: true, players: store.activePlayers, vacatedPlayer: currentPlayer, message: `${currentPlayer.name} returned to the queue in their original position.` };
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
async function assignPlayerToArenaSlotUnlocked(
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

  if (!Number.isInteger(slot) || slot < 1 || slot > 3) return { success: false, players: store.activePlayers, message: "Choose a valid car slot (1–3)." };
  if (store.raceStarted) return { success: false, players: store.activePlayers, message: "Track assignments are locked after the race starts. Finish this round first." };
  if (store.activePlayers.some(player => player.slot === slot && !player.isVacant)) return { success: false, players: store.activePlayers, message: "Vacate this car before assigning another player." };
  const queue = await getQueue();
  const queueItem = queue.find(item => item.rollNo === cleanRoll);
  if (!queueItem) return { success: false, players: store.activePlayers, message: "Register this player in the waiting queue before assigning a car." };
  const student = queueItem;

  // Remove from waiting queue if they were in the queue
  await removeFromQueueUnlocked(cleanRoll);

  // Seat the player in the slot
  const newPlayer: ActivePlayer = {
    slot,
    queueId: queueItem.id,
    queueEntry: queueItem,
    carId: TRACK_CARS[slot - 1],
    rollNo: student.rollNo,
    name: student.name,
    teamName: student.teamName,
    department: student.department,
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
async function editArenaPlayerUnlocked(
  slot: number,
  data: { name?: string; teamName?: string; rollNo?: string; department?: string }
): Promise<{ success: boolean; players: ActivePlayer[]; message: string }> {
  const store = getMockStore();
  store.activePlayers = ensureThreeSlots(store.activePlayers);

  const player = store.activePlayers.find((p) => p.slot === slot);
  if (!player || player.isVacant) {
    return { success: false, players: store.activePlayers, message: `No active player in Lane #${slot} to edit.` };
  }

  if (player.rollNo.startsWith("GUEST-")) return { success: false, players: store.activePlayers, message: "Use Edit walk-in profile to update this participant without changing their identity." };
  if (data.name) player.name = data.name.trim();
  if (typeof data.teamName === "string") player.teamName = data.teamName.trim();
  if (data.department) player.department = data.department.trim();
  if (data.rollNo) player.rollNo = data.rollNo.trim().toUpperCase();

  return {
    success: true,
    players: store.activePlayers,
    message: `Updated Lane #${slot} details successfully!`,
  };
}

// Un-bar a withdrawn contestant
async function unbarContestantUnlocked(rollNo: string): Promise<boolean> {
  const store = getMockStore();
  const clean = rollNo.trim().toUpperCase();
  const initial = store.withdrawn.length;
  store.withdrawn = store.withdrawn.filter((w) => w.rollNo.toUpperCase() !== clean);
  return store.withdrawn.length < initial;
}

// Timer actions
async function updateArenaPlayerUnlocked(
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
      if (!player.isRunning && player.status !== "disqualified" && player.status !== "finished") {
        store.raceStarted = true;
        store.startedAt ||= now;
        player.participant ||= await participantSnapshot(player);
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
        player.status = "stopped";
      }
      break;
    case "reset":
      if (player.laps?.length) throw new Error("Recorded laps cannot be erased. Save this round and start another.");
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
      if (player.isRunning && player.startTime) player.accumulatedMs += now - player.startTime;
      player.isRunning = false;
      player.startTime = null;
      player.stopTime = now;
      player.status = "disqualified";
      break;
  }

  return store.activePlayers;
}

async function updateArenaAllUnlocked(
  action: "start_all" | "stop_all" | "reset_all"
): Promise<ActivePlayer[]> {
  const store = getMockStore();
  const now = Date.now();

  if (action === "reset_all" && store.activePlayers.some(player => player.laps?.length)) throw new Error("Recorded laps cannot be erased. Save this round and start another.");
  for (const player of store.activePlayers) {
    if (player.isVacant || player.status === "disqualified") continue;

    if (action === "start_all") {
      if (!player.isRunning && player.status !== "finished") {
        store.raceStarted = true;
        store.startedAt ||= now;
        player.participant ||= await participantSnapshot(player);
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
        player.status = "stopped";
      }
    } else if (action === "reset_all") {
      player.startTime = null;
      player.stopTime = null;
      player.accumulatedMs = 0;
      player.isRunning = false;
      player.status = "ready";
    }
  }

  return store.activePlayers;
}

async function finishRoundUnlocked(): Promise<{
  round: MatchRound;
  allHistory: MatchRound[];
} | null> {
  const store = getMockStore();
  const validPlayers = store.activePlayers.filter((p) => !p.isVacant);
  if (validPlayers.length === 0) return null;
  if (!store.raceStarted) throw new Error("Start the race before saving results. Use Return all to queue to cancel preparation.");
  if (validPlayers.some(player => player.isRunning)) throw new Error("Stop all timers before saving the round.");

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
    raceId: store.raceId,
    targetLaps: store.targetLaps,
    startedAt: store.startedAt,
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
        status: p.status === "finished" || p.status === "disqualified" ? p.status : "dnf",
        laps: p.laps || [],
        participant: p.participant,
        penalties: p.penaltySeconds,
      };
    }),
  };

  const db = await getMongoDb();
  if (isMongoConfigured && !db) throw new Error("Database unavailable. This round has not been cleared; retry saving.");
  if (db) {
    await savePlayerResults(validPlayers, true);
    await db.collection("rounds").insertOne(completedRound);
  }
  store.history.unshift(completedRound);
  store.roundNumber += 1;
  store.activePlayers = ensureThreeSlots([]);
  store.raceStarted = false;
  store.raceId = randomUUID();
  store.startedAt = undefined;

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
    } catch (error) {
      if (isMongoConfigured) throw error;
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
          p.status === "finished" &&
          (existing.status !== "finished" || p.timeMs < existing.bestTimeMs)
        ) {
          existing.bestTimeMs = p.timeMs;
          existing.bestTimeFormatted = p.timeFormatted;
          existing.status = p.status;
          existing.penalties = p.penalties || 0;
        }
      }
    }
  }

  const currentProfiles = await hydrateWalkInNames(Array.from(participantsMap.values()));
  for (const profile of currentProfiles) {
    const entry = participantsMap.get(profile.rollNo.toUpperCase());
    if (entry) entry.name = profile.name;
  }

  // Sort: non-disqualified lowest time first, then disqualified at the bottom
  const sorted = Array.from(participantsMap.values()).sort((a, b) => {
    const priority = (status: string) => status === "finished" ? 0 : status === "dnf" ? 1 : 2;
    if (priority(a.status) !== priority(b.status)) return priority(a.status) - priority(b.status);
    return a.bestTimeMs - b.bestTimeMs;
  });

  // Assign ranks
  const ranked: LeaderboardEntry[] = sorted.map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));

  const totalParticipantsCount = ranked.length;
  const topThree = ranked.filter(player => player.status === "finished").slice(0, 3);

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

// RFID scans and admin requests can arrive at the same time. Serialize changes
// to the shared arena/queue to avoid duplicate registration or double seating.
type ArenaState = Pick<ReturnType<typeof getMockStore>, "activePlayers" | "roundNumber" | "raceStarted" | "raceId" | "targetLaps" | "startedAt" | "withdrawn">;
function arenaState(): ArenaState {
  const store = getMockStore();
  return { activePlayers: store.activePlayers, roundNumber: store.roundNumber, raceStarted: store.raceStarted, raceId: store.raceId, targetLaps: store.targetLaps, startedAt: store.startedAt, withdrawn: store.withdrawn };
}
async function readArenaState(): Promise<Partial<ArenaState>> {
  const db = await getMongoDb();
  if (isMongoConfigured && !db) throw new Error("Database unavailable. Race state could not be loaded.");
  if (!db) return {};
  const doc = await db.collection<{ _id: string; state: ArenaState }>("arena_state").findOne({ _id: "current" });
  if (doc) return doc.state;
  const latest = await db.collection<MatchRound>("rounds").find().sort({ roundNumber: -1 }).limit(1).toArray();
  return { roundNumber: (latest[0]?.roundNumber || 0) + 1 };
}
async function ensureArenaIndexes(db: Db) {
  globalThis._arenaIndexesReady ||= Promise.all([
    db.collection("arena_state").createIndex({ _id: 1 }),
    db.collection("queue").createIndex({ id: 1 }, { unique: true }),
    db.collection("walk_ins").createIndex({ id: 1 }, { unique: true }),
    db.collection("rounds").createIndex({ id: 1 }, { unique: true }),
    db.collection("lap_records").createIndex({ raceId: 1, rollNo: 1, lapNumber: 1 }, { unique: true }),
    db.collection("race_results").createIndex({ raceId: 1, rollNo: 1 }, { unique: true }),
    db.collection("rfid_cards").createIndex({ uid: 1 }, { unique: true }),
  ]).catch(error => { globalThis._arenaIndexesReady = undefined; throw error; });
  await globalThis._arenaIndexesReady;
}
function serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = (globalThis._registrationMutation || Promise.resolve()).then(async () => {
    const db = await getMongoDb();
    if (isMongoConfigured && !db) throw new Error("Database unavailable. Changes were not saved; please retry.");
    const before = structuredClone(arenaState());
    try {
      if (!db) return await operation();
      await ensureArenaIndexes(db);
      const client = await globalThis._mongoClientPromise!;
      return await client.withSession(session => session.withTransaction(() => arenaTransaction.run(session, async () => {
        Object.assign(getMockStore(), await readArenaState());
        const value = await operation();
        await savePlayerResults(getMockStore().activePlayers);
        await db.collection<{ _id: string; state: ArenaState }>("arena_state").replaceOne({ _id: "current" }, { state: arenaState() }, { upsert: true, session });
        return value;
      }), { timeoutMS: 20000, maxCommitTimeMS: 5000 }));
    } catch (error) { Object.assign(getMockStore(), before); throw error; }
  });
  globalThis._registrationMutation = result.catch(() => undefined);
  return result;
}

export function addToQueueByRollNo(...args: Parameters<typeof addToQueueByRollNoUnlocked>) {
  return serializeMutation(() => addToQueueByRollNoUnlocked(...args));
}

export function startNextThreeInArena(...args: Parameters<typeof startNextThreeInArenaUnlocked>) {
  return serializeMutation(() => startNextThreeInArenaUnlocked(...args));
}

export function assignPlayerToArenaSlot(...args: Parameters<typeof assignPlayerToArenaSlotUnlocked>) {
  return serializeMutation(() => assignPlayerToArenaSlotUnlocked(...args));
}

export function vacateArenaSlot(...args: Parameters<typeof vacateArenaSlotUnlocked>) {
  return serializeMutation(() => vacateArenaSlotUnlocked(...args));
}

export function removeFromQueue(...args: Parameters<typeof removeFromQueueUnlocked>) {
  return serializeMutation(() => removeFromQueueUnlocked(...args));
}

export function clearQueue(...args: Parameters<typeof clearQueueUnlocked>) {
  return serializeMutation(() => clearQueueUnlocked(...args));
}

export function finishRound(...args: Parameters<typeof finishRoundUnlocked>) {
  return serializeMutation(() => finishRoundUnlocked(...args));
}

export function editArenaPlayer(...args: Parameters<typeof editArenaPlayerUnlocked>) {
  return serializeMutation(() => editArenaPlayerUnlocked(...args));
}

export function updateArenaPlayer(...args: Parameters<typeof updateArenaPlayerUnlocked>) {
  return serializeMutation(() => updateArenaPlayerUnlocked(...args));
}

export function updateArenaAll(...args: Parameters<typeof updateArenaAllUnlocked>) {
  return serializeMutation(() => updateArenaAllUnlocked(...args));
}


function localWalkIns() {
  return globalThis._walkInProfiles ||= new Map<string, WalkInProfile>();
}

async function walkInDatabase() {
  const db = await getMongoDb();
  if (isMongoConfigured && !db) throw new Error("Database unavailable. Walk-in details were not saved; please retry.");
  return db;
}

export async function getWalkInProfile(id: string): Promise<WalkInProfile | null> {
  const db = await walkInDatabase();
  return db ? db.collection<WalkInProfile>("walk_ins").findOne({ id }, { projection: { _id: 0 } }) : localWalkIns().get(id) || null;
}

export async function listWalkIns(search = ""): Promise<WalkInProfile[]> {
  const db = await walkInDatabase();
  const profiles = db ? await db.collection<WalkInProfile>("walk_ins").find({}, { projection: { _id: 0 } }).sort({ registeredAt: -1 }).toArray() : Array.from(localWalkIns().values()).reverse();
  const query = search.trim().toLowerCase();
  return profiles.filter(profile => `${profile.id} ${profile.name} ${profile.email} ${profile.phone} ${profile.extras}`.toLowerCase().includes(query)).slice(0, 100);
}

function walkInFields(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Provide a name and optional contact details.");
  const record = input as Record<string, unknown>;
  const fields = { name: "", email: "", phone: "", extras: "" };
  for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
    const value = record[key];
    if (value !== undefined && typeof value !== "string") throw new Error(`${key} must be text.`);
    fields[key] = typeof value === "string" ? value.trim() : "";
    if (fields[key].length > (key === "extras" ? 4000 : 250)) throw new Error(`${key} is too long.`);
  }
  if (!fields.name) throw new Error("Name is required.");
  return fields;
}

export function createWalkIn(input: unknown) {
  return serializeMutation(async () => {
    const fields = walkInFields(input);
    const id = `GUEST-${randomUUID().toUpperCase()}`;
    const now = new Date().toISOString();
    const profile: WalkInProfile = { id, rollNo: id, participantType: "external", ...fields, registeredAt: now, updatedAt: now };
    const db = await walkInDatabase();
    if (db) {
      await db.collection("walk_ins").insertOne({ ...profile });
    } else localWalkIns().set(id, profile);
    const registration = await addToQueueByRollNoUnlocked(id, undefined, "walk-in");
    return { profile, queued: registration.success, message: registration.success ? "Walk-in registered and added to the waiting queue." : `Profile saved. ${registration.message}` };
  });
}

export function updateWalkIn(id: string, input: unknown) {
  return serializeMutation(async () => {
    const current = await getWalkInProfile(id);
    if (!current) return null;
    const fields = walkInFields({ ...current, ...(input && typeof input === "object" ? input : {}) });
    const profile = { ...current, ...fields, updatedAt: new Date().toISOString() };
    const db = await walkInDatabase();
    if (db) await db.collection<WalkInProfile>("walk_ins").updateOne({ id }, { $set: { ...fields, updatedAt: profile.updatedAt } });
    else localWalkIns().set(id, profile);
    // Identity, car assignment, timers and results remain untouched.
    const store = getMockStore();
    for (const item of [...store.queue, ...store.activePlayers, ...store.withdrawn, ...store.history.flatMap(round => round.players)]) {
      if (item.rollNo === id) item.name = profile.name;
    }
    return profile;
  });
}

async function hydrateWalkInNames<T extends { rollNo: string; name: string }>(items: T[]): Promise<T[]> {
  const ids = Array.from(new Set(items.filter(item => item.rollNo.startsWith("GUEST-")).map(item => item.rollNo)));
  if (!ids.length) return items;
  const db = await walkInDatabase();
  const profiles = db ? await db.collection<WalkInProfile>("walk_ins").find({ id: { $in: ids } }, { projection: { id: 1, name: 1 } }).toArray() : ids.map(id => localWalkIns().get(id)).filter(Boolean);
  const names = new Map(profiles.map(profile => [profile!.id, profile!.name]));
  return items.map(item => names.has(item.rollNo) ? { ...item, name: names.get(item.rollNo)! } : item);
}


async function restoreQueueEntries(players: ActivePlayer[]) {
  const store = getMockStore();
  const current = await getQueue();
  const entries: QueueItem[] = players.filter(player => !current.some(item => item.rollNo === player.rollNo)).map(player => ({
    ...(player.queueEntry || { id: player.queueId || `queue_${randomUUID()}`, rollNo: player.rollNo, enqueuedAt: new Date().toISOString(), registrationSource: player.rollNo.startsWith("GUEST-") ? "walk-in" as const : "manual" as const }),
    name: player.name, teamName: player.teamName, department: player.department, status: "waiting" as const,
  }));
  const db = await getMongoDb();
  if (isMongoConfigured && !db) throw new Error("Database unavailable. Players remain on their tracks; please retry.");
  if (db && entries.length) await db.collection("queue").bulkWrite(entries.map(entry => ({ updateOne: { filter: { id: entry.id }, update: { $set: entry }, upsert: true } })));
  if (!db) store.queue.push(...entries);
  store.queue.sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
}

export function moveTrackPlayer(fromSlot: number, toSlot: number) {
  return serializeMutation(async () => {
    const store = getMockStore();
    store.activePlayers = ensureThreeSlots(store.activePlayers);
    if (![fromSlot, toSlot].every(slot => Number.isInteger(slot) && slot >= 1 && slot <= 3) || fromSlot === toSlot) return { success: false, players: store.activePlayers, message: "Choose two different tracks (1–3)." };
    if (store.raceStarted) return { success: false, players: store.activePlayers, message: "Tracks can only be changed before the race starts." };
    const source = store.activePlayers[fromSlot - 1];
    const target = store.activePlayers[toSlot - 1];
    if (source.isVacant) return { success: false, players: store.activePlayers, message: "There is no player on that track." };
    store.activePlayers[toSlot - 1] = { ...source, slot: toSlot, carId: TRACK_CARS[toSlot - 1] };
    store.activePlayers[fromSlot - 1] = { ...target, slot: fromSlot, carId: TRACK_CARS[fromSlot - 1] };
    return { success: true, players: store.activePlayers, message: target.isVacant ? `${source.name} moved to Track ${toSlot}.` : `Players on Tracks ${fromSlot} and ${toSlot} swapped.` };
  });
}

export function returnAllToQueue() {
  return serializeMutation(async () => {
    const store = getMockStore();
    const players = store.activePlayers.filter(player => !player.isVacant);
    if (store.raceStarted) return { success: false, players: store.activePlayers, message: "The race has started. Finish this round before setting up another." };
    await restoreQueueEntries(players);
    store.activePlayers = ensureThreeSlots([]);
    return { success: true, players: store.activePlayers, message: "All players returned to their original queue positions. You can set up the tracks again." };
  });
}


async function participantSnapshot(player: { rollNo: string; name: string; teamName?: string; department?: string }): Promise<ParticipantSnapshot> {
  if (player.rollNo.startsWith("GUEST-")) {
    const profile = await getWalkInProfile(player.rollNo);
    return { rollNo: player.rollNo, name: profile?.name || player.name, participantType: "external", email: profile?.email, phone: profile?.phone, extras: profile?.extras, teamName: player.teamName };
  }
  const student = await findStudentByRollNo(player.rollNo);
  return { rollNo: player.rollNo, name: player.name, participantType: "student", email: student?.email, phone: student?.contact, teamName: player.teamName, department: player.department };
}

export function configureRace(targetLaps: unknown) {
  return serializeMutation(async () => {
    const store = getMockStore();
    if (store.raceStarted) throw new Error("Lap target cannot change after starting the race.");
    if (!Number.isInteger(targetLaps) || Number(targetLaps) < 1 || Number(targetLaps) > 100) throw new Error("Choose between 1 and 100 laps.");
    store.targetLaps = Number(targetLaps);
    return { success: true, targetLaps: store.targetLaps, message: `Race set to ${targetLaps} laps per player.` };
  });
}

export function recordPlayerLap(input: { raceId: string; slot: number; lapNumber: number; eventId: string; occurredAt?: number; source?: "manual" | "tracker" }) {
  return serializeMutation(async () => {
    const store = getMockStore();
    if (input.raceId !== store.raceId || !store.raceStarted) throw new Error("This lap does not belong to the active race.");
    if (!Number.isInteger(input.slot) || input.slot < 1 || input.slot > 3) throw new Error("Choose a valid track.");
    const player = store.activePlayers.find(player => player.slot === input.slot && !player.isVacant);
    if (!player) throw new Error("No player is assigned to this track.");
    const laps = player.laps ||= [];
    const duplicate = laps.find(lap => lap.eventId === input.eventId || lap.lapNumber === input.lapNumber);
    if (duplicate) return { success: true, duplicate: true, lap: duplicate, players: store.activePlayers, message: "This lap is already saved." };
    if (!player.isRunning || !player.startTime || player.status === "finished") throw new Error("The player's timer is not running.");
    if (!Number.isInteger(input.lapNumber) || input.lapNumber !== laps.length + 1 || input.lapNumber > store.targetLaps!) throw new Error("Lap numbers must arrive in order without gaps.");
    if (typeof input.eventId !== "string" || !input.eventId.trim() || input.eventId.length > 200) throw new Error("A unique lap event ID is required.");
    const now = Date.now();
    const crossing = input.occurredAt ?? now;
    if (!Number.isSafeInteger(crossing) || crossing < player.startTime || crossing > now + 250) throw new Error("Lap timestamp is outside this running timer interval.");
    const elapsedMs = player.accumulatedMs + crossing - player.startTime;
    const previous = laps.at(-1)?.elapsedMs || 0;
    if (elapsedMs <= previous) throw new Error("A lap must have a positive duration after the previous crossing.");
    const lap: LapRecord = { lapNumber: input.lapNumber, lapTimeMs: elapsedMs - previous, elapsedMs, completedAt: new Date(crossing).toISOString(), eventId: input.eventId, source: input.source || "manual" };
    player.participant ||= await participantSnapshot(player);
    const db = await getMongoDb();
    if (db) await db.collection("lap_records").insertOne({ raceId: store.raceId, roundNumber: store.roundNumber, carId: player.carId, slot: player.slot, rollNo: player.rollNo, participant: player.participant, ...lap });
    laps.push(lap);
    if (laps.length === store.targetLaps) {
      player.accumulatedMs = elapsedMs; player.startTime = null; player.stopTime = crossing; player.isRunning = false; player.status = "finished";
    }
    return { success: true, duplicate: false, lap, players: store.activePlayers, message: player.status === "finished" ? `${player.name} completed all ${store.targetLaps} laps. Timer stopped and results saved.` : `Lap ${lap.lapNumber} saved for ${player.name}.` };
  });
}

export async function listRFIDCards() {
  const db = await getMongoDb();
  return db ? db.collection("rfid_cards").find({}, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).limit(100).toArray() : [];
}
export function pairRFIDCard(uid: unknown, rollNo: unknown) {
  return serializeMutation(async () => {
    if (typeof uid !== "string" || !uid.trim() || uid.length > 200 || typeof rollNo !== "string" || !rollNo.trim()) throw new Error("Card UID and student roll number are required.");
    const student = await findStudentByRollNo(rollNo);
    if (!student || student.rollNo.startsWith("GUEST-")) throw new Error("Student roll number was not found in the directory.");
    const db = await getMongoDb();
    if (!db) throw new Error("Connect MongoDB to save card pairings.");
    await db.collection("rfid_cards").updateOne({ uid: uid.trim().toUpperCase() }, { $set: { uid: uid.trim().toUpperCase(), rollNo: student.rollNo, updatedAt: new Date().toISOString() } }, { upsert: true });
    return { success: true, message: `Card paired with ${student.name}.` };
  });
}
export async function resolveRFIDCard(uid: unknown) {
  if (typeof uid !== "string" || !uid.trim()) return null;
  const db = await getMongoDb();
  const card = db ? await db.collection("rfid_cards").findOne({ uid: uid.trim().toUpperCase() }) : null;
  return card?.rollNo as string | undefined || null;
}

async function savePlayerResults(players: ActivePlayer[], final = false) {
  const db = await getMongoDb();
  if (!db) return;
  const store = getMockStore();
  for (const player of players) {
    if (player.isVacant || (!player.laps?.length && !final)) continue;
    const rawMs = player.status === "finished" ? player.accumulatedMs : player.laps?.at(-1)?.elapsedMs || player.accumulatedMs;
    await db.collection("race_results").updateOne({ raceId: store.raceId, rollNo: player.rollNo }, { $set: {
      raceId: store.raceId, roundNumber: store.roundNumber, slot: player.slot, carId: player.carId, rollNo: player.rollNo,
      participant: player.participant, laps: player.laps || [], targetLaps: store.targetLaps,
      elapsedMs: final ? player.accumulatedMs : rawMs, penalties: player.penaltySeconds || 0,
      timeMs: (final ? player.accumulatedMs : rawMs) + (player.penaltySeconds || 0) * 1000,
      status: final && player.status !== "finished" && player.status !== "disqualified" ? "dnf" : player.status,
      updatedAt: new Date().toISOString(),
    } }, { upsert: true });
  }
}

export function unbarContestant(rollNo: string) { return serializeMutation(() => unbarContestantUnlocked(rollNo)); }
