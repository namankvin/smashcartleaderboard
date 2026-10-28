"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Users,
  Search,
  Plus,
  Upload,
  CheckCircle2,
  AlertCircle,
  Bot,
  PlusCircle,
} from "lucide-react";
import { Student } from "@/lib/types";
import { soundFx } from "@/lib/sound";

interface StudentDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentEnqueued: () => void;
}

export const StudentDatabaseModal: React.FC<StudentDatabaseModalProps> = ({
  isOpen,
  onClose,
  onStudentEnqueued,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  // New Student single form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRoll, setNewRoll] = useState("");
  const [newName, setNewName] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [newDept, setNewDept] = useState("");

  const fetchStudents = async (query = "") => {
    setLoading(true);
    try {
      const url = query
        ? `/api/students?q=${encodeURIComponent(query)}`
        : "/api/students";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setStudents(data.students);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStudents(search);
    }
  }, [isOpen, search]);

  if (!isOpen) return null;

  const handleImportJson = async () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed) && !Array.isArray(parsed.students)) {
        setFeedback("Error: JSON must be an array of students or { students: [...] }");
        return;
      }

      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonInput,
      });
      const data = await res.json();

      if (data.success) {
        soundFx.playEnqueueSound();
        setFeedback(`Success: ${data.message}`);
        setJsonInput("");
        setShowJsonImport(false);
        fetchStudents();
      } else {
        setFeedback(`Failed: ${data.message || data.error}`);
      }
    } catch (err) {
      setFeedback("Invalid JSON format. Please verify syntax.");
    }
  };

  const handleAddSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoll || !newName) return;

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rollNo: newRoll,
          name: newName,
          teamName: newTeam || "Autonomous Bot",
          department: newDept || "Engineering",
        }),
      });
      const data = await res.json();
      if (data.success) {
        soundFx.playBlip();
        setNewRoll("");
        setNewName("");
        setNewTeam("");
        setNewDept("");
        setShowAddForm(false);
        fetchStudents();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDirectEnqueue = async (rollNo: string) => {
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNo }),
      });
      const data = await res.json();
      if (data.success) {
        soundFx.playEnqueueSound();
        onStudentEnqueued();
        alert(`Added ${rollNo} to queue successfully!`);
      } else {
        alert(data.message || "Failed to add to queue");
      }
    } catch {
      alert("Error adding to queue");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0b1220] border border-cyan-500/50 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative tech-frame">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-mono text-base font-bold text-cyan-300 uppercase tracking-wider">
                STUDENTS DATABASE DIRECTORY
              </h3>
              <p className="text-xs font-mono text-slate-400">
                Registered robotics contestants & contestant records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search, Add Student, Import JSON */}
        <div className="my-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Roll No, Name, or Team..."
              className="w-full bg-[#060a14] border border-cyan-900/60 focus:border-cyan-400 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-slate-200 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Add Single</span>
            </button>

            <button
              onClick={() => setShowJsonImport(!showJsonImport)}
              className="px-3 py-2 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 font-mono text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Database JSON</span>
            </button>
          </div>
        </div>

        {/* JSON Importer Drawer */}
        {showJsonImport && (
          <div className="my-3 p-4 rounded-xl bg-[#070c17] border border-cyan-500/40 animate-fadeIn">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-cyan-300 uppercase">
                PASTE YOUR STUDENTS DATABASE (JSON ARRAY)
              </span>
              <button
                onClick={() => {
                  setJsonInput(
                    JSON.stringify(
                      [
                        {
                          rollNo: "24NEW01",
                          name: "Karan Patel",
                          teamName: "Vortex Bot",
                          department: "Robotics",
                        },
                        {
                          rollNo: "24NEW02",
                          name: "Priya Sharma",
                          teamName: "Alpha Drone",
                          department: "Electronics",
                        },
                      ],
                      null,
                      2
                    )
                  );
                }}
                className="text-[10px] font-mono text-cyan-400 hover:underline cursor-pointer"
              >
                Load Sample JSON
              </button>
            </div>
            <textarea
              rows={5}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='[{"rollNo": "24ROB201", "name": "Rahul Roy", "teamName": "Cyber Bot", "department": "Robotics"}]'
              className="w-full bg-[#050811] border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-400 outline-none focus:border-cyan-400"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400">
                You can paste your full university/college student list here anytime.
              </span>
              <button
                onClick={handleImportJson}
                disabled={!jsonInput.trim()}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-bold uppercase transition-all cursor-pointer disabled:bg-slate-800 disabled:text-slate-600"
              >
                Save To Database
              </button>
            </div>
          </div>
        )}

        {/* Add Single Form Drawer */}
        {showAddForm && (
          <form
            onSubmit={handleAddSingleStudent}
            className="my-3 p-4 rounded-xl bg-[#070c17] border border-cyan-500/40 grid grid-cols-1 sm:grid-cols-4 gap-2.5 animate-fadeIn"
          >
            <input
              type="text"
              required
              placeholder="Roll No (e.g. 24ROB999)"
              value={newRoll}
              onChange={(e) => setNewRoll(e.target.value.toUpperCase())}
              className="bg-[#050811] border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 uppercase"
            />
            <input
              type="text"
              required
              placeholder="Student Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-[#050811] border border-slate-800 rounded p-2 text-xs font-mono text-slate-200"
            />
            <input
              type="text"
              placeholder="Team / Bot Name"
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              className="bg-[#050811] border border-slate-800 rounded p-2 text-xs font-mono text-slate-200"
            />
            <button
              type="submit"
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold rounded py-2 transition-all cursor-pointer"
            >
              Save Student
            </button>
          </form>
        )}

        {/* Status Message */}
        {feedback && (
          <div className="my-2 p-2 rounded bg-cyan-950/40 text-cyan-300 font-mono text-xs">
            {feedback}
          </div>
        )}

        {/* Students Table */}
        <div className="mt-4 border border-slate-800 rounded-xl overflow-hidden bg-[#070c17]">
          <div className="overflow-x-auto max-h-[380px]">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#09101f] text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Roll No</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Team / Robot</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No students found matching search.
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.rollNo} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-cyan-300">
                        {student.rollNo}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-200">
                        {student.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {student.teamName || "Independent"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {student.department || "Robotics"}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDirectEnqueue(student.rollNo)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-950 text-cyan-300 hover:border-cyan-500/50 border border-slate-700 text-[10px] font-mono transition-all cursor-pointer"
                        >
                          + Add to Queue
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

