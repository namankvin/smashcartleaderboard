"use client";

import React, { useState } from "react";
import {
  X,
  Radio,
  Copy,
  Check,
  Send,
  Code2,
  Terminal,
  FileCode,
  Zap,
} from "lucide-react";
import { soundFx } from "@/lib/sound";

interface WebhookSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessEnqueued: () => void;
}

export const WebhookSimulatorModal: React.FC<WebhookSimulatorModalProps> = ({
  isOpen,
  onClose,
  onSuccessEnqueued,
}) => {
  const [testRoll, setTestRoll] = useState("24ROB101");
  const [loading, setLoading] = useState(false);
  const [responseLog, setResponseLog] = useState<string | null>(null);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<"curl" | "fetch" | "python">("curl");

  if (!isOpen) return null;

  const currentOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://your-domain.vercel.app";
  const webhookUrl = `${currentOrigin}/api/webhook/roll-no`;

  const curlCode = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"rollNo": "${testRoll || "24ROB101"}"}'`;

  const fetchCode = `// Call from your main website's frontend or backend
const response = await fetch("${webhookUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    rollNo: "${testRoll || "24ROB101"}"
  }),
});

const data = await response.json();
console.log("Queue Status:", data);`;

  const pythonCode = `import requests

url = "${webhookUrl}"
payload = {"rollNo": "${testRoll || "24ROB101"}"}

response = requests.post(url, json=payload)
print(response.json())`;

  const handleCopy = (text: string, tab: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tab);
    soundFx.playBlip();
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const handleSendTestWebhook = async () => {
    if (!testRoll.trim()) return;
    setLoading(true);
    setResponseLog(null);
    soundFx.playBlip();

    try {
      const res = await fetch("/api/webhook/roll-no", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNo: testRoll.trim() }),
      });
      const data = await res.json();
      setResponseLog(JSON.stringify(data, null, 2));

      if (data.success) {
        soundFx.playEnqueueSound();
        onSuccessEnqueued();
      }
    } catch (err) {
      setResponseLog(
        JSON.stringify({ error: "Failed to send request", details: String(err) }, null, 2)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0b1220] border border-cyan-500/50 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative tech-frame">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-mono text-base font-bold text-cyan-300 uppercase tracking-wider">
                MAIN WEBSITE WEBHOOK INTEGRATION
              </h3>
              <p className="text-xs font-mono text-slate-400">
                Endpoint to automatically receive student roll numbers from your main website
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

        {/* Endpoint Banner */}
        <div className="my-4 p-3.5 rounded-xl bg-[#060a14] border border-cyan-900/60 font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold block mb-1">
              POST ENDPOINT URL
            </span>
            <code className="text-slate-200 font-bold select-all">{webhookUrl}</code>
          </div>
          <button
            onClick={() => handleCopy(webhookUrl, "url")}
            className="self-start sm:self-auto px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedTab === "url" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedTab === "url" ? "Copied" : "Copy URL"}</span>
          </button>
        </div>

        {/* Live Simulator Test Trigger */}
        <div className="my-5 p-4 rounded-xl bg-[#0d1629] border border-cyan-500/30">
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 mb-2">
            Interactive Test Trigger (Simulate Main Website Send)
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={testRoll}
              onChange={(e) => setTestRoll(e.target.value.toUpperCase())}
              placeholder="Enter Roll No (e.g. 24ROB101)..."
              className="flex-1 bg-[#060a14] border border-cyan-900 rounded-lg px-3.5 py-2.5 text-cyan-100 font-mono text-sm tracking-wider uppercase outline-none focus:border-cyan-400"
            />
            <button
              onClick={handleSendTestWebhook}
              disabled={loading || !testRoll.trim()}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 disabled:from-slate-800 disabled:to-slate-800 text-slate-950 font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-cyan-glow transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? "Sending..." : "Send Test Webhook"}</span>
            </button>
          </div>

          {responseLog && (
            <div className="mt-3">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-1">
                Server Response Payload:
              </span>
              <pre className="p-3 rounded-lg bg-[#050811] border border-slate-800 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-40">
                {responseLog}
              </pre>
            </div>
          )}
        </div>

        {/* Code Snippets for Developers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => setActiveCodeTab("curl")}
                className={`px-3 py-1.5 rounded-t-md font-bold transition-all ${
                  activeCodeTab === "curl"
                    ? "bg-slate-800 text-cyan-300 border-t-2 border-cyan-400"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                cURL
              </button>
              <button
                onClick={() => setActiveCodeTab("fetch")}
                className={`px-3 py-1.5 rounded-t-md font-bold transition-all ${
                  activeCodeTab === "fetch"
                    ? "bg-slate-800 text-cyan-300 border-t-2 border-cyan-400"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                JavaScript (Fetch)
              </button>
              <button
                onClick={() => setActiveCodeTab("python")}
                className={`px-3 py-1.5 rounded-t-md font-bold transition-all ${
                  activeCodeTab === "python"
                    ? "bg-slate-800 text-cyan-300 border-t-2 border-cyan-400"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Python (Requests)
              </button>
            </div>

            <button
              onClick={() => {
                const code =
                  activeCodeTab === "curl"
                    ? curlCode
                    : activeCodeTab === "fetch"
                    ? fetchCode
                    : pythonCode;
                handleCopy(code, activeCodeTab);
              }}
              className="text-[11px] font-mono text-slate-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
            >
              {copiedTab === activeCodeTab ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedTab === activeCodeTab ? "Copied" : "Copy Code"}</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-[#060a14] border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
            <pre>
              {activeCodeTab === "curl"
                ? curlCode
                : activeCodeTab === "fetch"
                ? fetchCode
                : pythonCode}
            </pre>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-5 pt-3 border-t border-slate-800 text-center font-mono text-[11px] text-slate-400">
          💡 The server automatically looks up the student name from the database and inserts them into the queue in real-time.
        </div>

      </div>
    </div>
  );
};

