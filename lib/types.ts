export interface Student {
  _id?: string;
  rollNo: string;
  name: string;
  teamName?: string;
  department?: string;
  year?: string;
  contact?: string;
  email?: string;
  registeredAt?: string;
}

export interface QueueItem {
  id: string;
  rollNo: string;
  name: string;
  teamName?: string;
  department?: string;
  registrationSource?: "manual" | "rfid" | "webhook" | "walk-in";
  enqueuedAt: string;
  status: 'waiting' | 'ready' | 'playing' | 'completed';
}

export interface ActivePlayer {
  slot: number; // 1, 2, or 3
  queueId?: string;
  carId?: string;
  queueEntry?: QueueItem;
  laps?: LapRecord[];
  participant?: ParticipantSnapshot;
  rollNo: string;
  name: string;
  teamName?: string;
  department?: string;
  startTime: number | null; // timestamp when started
  stopTime: number | null;  // timestamp when stopped
  accumulatedMs: number;    // accumulated time when paused
  isRunning: boolean;
  status: 'ready' | 'running' | 'stopped' | 'finished' | 'disqualified' | 'withdrawn' | 'vacant';
  penaltySeconds?: number;
  isVacant?: boolean;
  withdrawalReason?: string;
}

export interface WithdrawnRecord {
  rollNo: string;
  name: string;
  teamName?: string;
  slot: number;
  withdrawnAt: string;
  roundNumber: number;
  reason: string;
  barredFromNextRound: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  rollNo: string;
  name: string;
  teamName?: string;
  department?: string;
  bestTimeMs: number;
  bestTimeFormatted: string;
  roundsPlayed: number;
  lapsCompleted: number;
  status: string;
  penalties: number;
  lastPlayedAt: string;
}

export interface MatchRound {
  id: string;
  roundNumber: number;
  completedAt: string;
  raceId?: string;
  targetLaps?: number;
  startedAt?: number;
  players: {
    slot: number;
    rollNo: string;
    name: string;
    teamName?: string;
    timeMs: number;
    timeFormatted: string;
    status: string;
    penalties?: number;
    laps?: LapRecord[];
    participant?: ParticipantSnapshot;
  }[];
}

export interface DbStatus {
  connectedToMongo: boolean;
  mongoUriConfigured: boolean;
  source: 'mongodb' | 'mock-in-memory';
  totalStudents: number;
  totalInQueue: number;
  activeRound: number;
}

export interface WalkInProfile {
  id: string;
  rollNo: string; // Internal compatibility reference, never requested from a guest.
  participantType: "external";
  name: string;
  email: string;
  phone: string;
  extras: string;
  registeredAt: string;
  updatedAt: string;
}

export interface LapRecord {
  lapNumber: number;
  lapTimeMs: number;
  elapsedMs: number;
  completedAt: string;
  source: "manual" | "tracker";
  eventId: string;
}
export interface ParticipantSnapshot {
  rollNo: string;
  name: string;
  participantType: "student" | "external";
  email?: string;
  phone?: string;
  extras?: string;
  teamName?: string;
  department?: string;
}
