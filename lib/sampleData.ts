import { Student, MatchRound } from "./types";

export const SAMPLE_STUDENTS: Student[] = [
  {
    rollNo: "24ROB101",
    name: "Aarav Sharma",
    teamName: "Mecha Titans",
    department: "Robotics & Automation",
    year: "3rd Year",
    contact: "aarav@robotics.edu"
  },
  {
    rollNo: "24ROB102",
    name: "Diya Patel",
    teamName: "Cyber Hawks",
    department: "Robotics & Automation",
    year: "3rd Year",
    contact: "diya@robotics.edu"
  },
  {
    rollNo: "24EC205",
    name: "Rohan Verma",
    teamName: "Circuit Breakers",
    department: "Electronics & Comm",
    year: "4th Year",
    contact: "rohan@robotics.edu"
  },
  {
    rollNo: "24CS312",
    name: "Ananya Iyer",
    teamName: "Neural Sparks",
    department: "Computer Science",
    year: "2nd Year",
    contact: "ananya@robotics.edu"
  },
  {
    rollNo: "24ME401",
    name: "Vikram Singhania",
    teamName: "Hydraulic Vipers",
    department: "Mechanical Engg",
    year: "4th Year",
    contact: "vikram@robotics.edu"
  },
  {
    rollNo: "24EE118",
    name: "Sneha Reddy",
    teamName: "Volt Velocity",
    department: "Electrical Engg",
    year: "3rd Year",
    contact: "sneha@robotics.edu"
  },
  {
    rollNo: "24AI505",
    name: "Kabir Mehta",
    teamName: "Robo-Sapiens",
    department: "Artificial Intelligence",
    year: "2nd Year",
    contact: "kabir@robotics.edu"
  },
  {
    rollNo: "24ROB108",
    name: "Pooja Kulkarni",
    teamName: "Aero Drones",
    department: "Robotics & Automation",
    year: "3rd Year",
    contact: "pooja@robotics.edu"
  },
  {
    rollNo: "24CS220",
    name: "Tanya Sen",
    teamName: "Binary Blitz",
    department: "Computer Science",
    year: "4th Year",
    contact: "tanya@robotics.edu"
  },
  {
    rollNo: "24EC330",
    name: "Arjun Nair",
    teamName: "Quantum Crawlers",
    department: "Electronics & Comm",
    year: "3rd Year",
    contact: "arjun@robotics.edu"
  }
];

export const SAMPLE_MATCH_HISTORY: MatchRound[] = [
  {
    id: "round_demo_2",
    roundNumber: 2,
    completedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    players: [
      {
        slot: 1,
        rollNo: "24CS312",
        name: "Ananya Iyer",
        teamName: "Neural Sparks",
        timeMs: 69150,
        timeFormatted: "01:09.150",
        status: "finished",
        penalties: 0,
      },
      {
        slot: 2,
        rollNo: "24EE118",
        name: "Sneha Reddy",
        teamName: "Volt Velocity",
        timeMs: 76480,
        timeFormatted: "01:16.480",
        status: "finished",
        penalties: 0,
      },
      {
        slot: 3,
        rollNo: "24ME401",
        name: "Vikram Singhania",
        teamName: "Hydraulic Vipers",
        timeMs: 82600,
        timeFormatted: "01:22.600",
        status: "finished",
        penalties: 5,
      },
    ],
  },
  {
    id: "round_demo_1",
    roundNumber: 1,
    completedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    players: [
      {
        slot: 1,
        rollNo: "24ROB101",
        name: "Aarav Sharma",
        teamName: "Mecha Titans",
        timeMs: 72320,
        timeFormatted: "01:12.320",
        status: "finished",
        penalties: 0,
      },
      {
        slot: 2,
        rollNo: "24ROB102",
        name: "Diya Patel",
        teamName: "Cyber Hawks",
        timeMs: 78850,
        timeFormatted: "01:18.850",
        status: "finished",
        penalties: 0,
      },
      {
        slot: 3,
        rollNo: "24EC205",
        name: "Rohan Verma",
        teamName: "Circuit Breakers",
        timeMs: 89400,
        timeFormatted: "01:29.400",
        status: "finished",
        penalties: 5,
      },
    ],
  },
];
