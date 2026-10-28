export interface Student {
  _id?: string;
  rollNo: string;
  name: string;
  teamName?: string;
  department?: string;
  year?: string;
  contact?: string;
  registeredAt?: string;
}

export interface QueueItem {
  id: string;
  rollNo: string;
  name: string;
  teamName?: string;
  department?: string;
  enqueuedAt: string;
  status: 'waiting' | 'ready' | 'playing' | 'completed';
}

export interface ActivePlayer {
  slot: number; // 1, 2, or 3
  queueId?: string;
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
  status: string;
  penalties: number;
  lastPlayedAt: string;
}

export interface MatchRound {
  id: string;
  roundNumber: number;
  completedAt: string;
  players: {
    slot: number;
    rollNo: string;
    name: string;
    teamName?: string;
    timeMs: number;
    timeFormatted: string;
    status: string;
    penalties?: number;
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
