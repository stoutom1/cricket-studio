"use client";

import { useEffect, useState } from "react";

const INTRO_KEY = "cric4all-ai-intro-seen";

export default function CricChatbot() {
  const [open, setOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi! I’m Cric4All AI. Ask me about scoring, matches, leagues, stats, or spectator links.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(INTRO_KEY);

    if (!seen) {
      setShowIntro(true);
      setPulse(true);

      const introTimer = setTimeout(() => {
        setShowIntro(false);
        localStorage.setItem(INTRO_KEY, "true");
      }, 8000);

      const pulseTimer = setTimeout(() => {
        setPulse(false);
      }, 10000);

      return () => {
        clearTimeout(introTimer);
        clearTimeout(pulseTimer);
      };
    }
  }, []);

  function markIntroSeen() {
    setShowIntro(false);
    setPulse(false);
    localStorage.setItem(INTRO_KEY, "true");
  }

  function openChat() {
    markIntroSeen();
    setOpen(true);
  }

  async function sendMessage(customText) {
    const text = (customText || input).trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply || data.error || "Sorry, something went wrong.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Sorry, Cric4All AI is unavailable right now.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const quickQuestions = [
    "How do I score a wide?",
    "How do I score a no-ball?",
    "How do I share spectator view?",
  ];

  return (
    <>
      <style>{`
@keyframes cricAiPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.08); }
  100% { transform: scale(1); }
}

.cric-ai-fab {
  position: fixed;
  right: 18px;
  bottom: 18px;
  width: 56px;
  height: 56px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.25);
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  color: white;
  font-size: 24px;
  font-weight: 900;
  cursor: pointer;
  z-index: 9999;
  box-shadow: 0 8px 26px rgba(37, 99, 235, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cric-ai-fab.pulse {
  animation: cricAiPulse 2s ease-in-out infinite;
}

.cric-ai-fab:active {
  transform: scale(0.94);
}

.cric-ai-intro {
  position: fixed;
  right: 18px;
  bottom: 84px;
  width: 255px;
  background: linear-gradient(135deg, #ffffff, #eff6ff);
  color: #0f172a;
  border: 1px solid rgba(59,130,246,0.35);
  border-radius: 16px;
  padding: 12px 14px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.25);
  font-size: 13px;
  line-height: 1.35;
  z-index: 9998;
}

.cric-ai-intro-title {
  font-weight: 900;
  margin-bottom: 4px;
}

.cric-ai-intro-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.cric-ai-intro-actions button {
  border: none;
  border-radius: 999px;
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.cric-ai-try {
  background: #2563eb;
  color: white;
}

.cric-ai-dismiss {
  background: #e5e7eb;
  color: #111827;
}

.cric-ai-panel {
  position: fixed;
  right: 18px;
  bottom: 84px;
  width: min(390px, calc(100vw - 28px));
  height: 540px;
  background: white;
  color: #111827;
  border-radius: 18px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.38);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(59,130,246,0.35);
}

/* Production mobile docked mode */
@media (max-width: 520px) {
  .cric-ai-fab {
    width: 52px;
    height: 52px;
    right: max(8px, env(safe-area-inset-right));
    bottom: max(8px, env(safe-area-inset-bottom));
    font-size: 22px;
    box-shadow:
      0 6px 20px rgba(0,0,0,.30),
      0 0 0 3px rgba(255,255,255,.85);
  }

  .cric-ai-intro {
    right: max(10px, env(safe-area-inset-right));
    bottom: calc(64px + env(safe-area-inset-bottom));
    width: 235px;
  }

  .cric-ai-panel {
    left: 10px;
    right: 10px;
    bottom: calc(64px + env(safe-area-inset-bottom));
    width: auto;
    height: 72vh;
    border-radius: 16px;
  }
} 
      `}</style>

      <button
        type="button"
        className={`cric-ai-fab ${pulse ? "pulse" : ""}`}
        onClick={openChat}
        title="Cric4All AI Assistant"
        aria-label="Open Cric4All AI Assistant"
      >
        🤖
      </button>

      {open && (
        <div className="cric-ai-panel">
          <div
            style={{
              padding: 14,
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              color: "white",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>
                🏏 Cric4All AI
              </div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                Scoring • Matches • Leagues • Stats
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: "rgba(255,255,255,0.15)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 999,
                width: 30,
                height: 30,
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              flex: 1,
              padding: 12,
              overflowY: "auto",
              background: "#f8fafc",
            }}
          >
            {messages.map((m, index) => (
              <div
                key={index}
                style={{
                  marginBottom: 10,
                  textAlign: m.role === "user" ? "right" : "left",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    padding: "9px 11px",
                    borderRadius: 14,
                    background:
                      m.role === "user"
                        ? "linear-gradient(135deg, #2563eb, #7c3aed)"
                        : "#e5e7eb",
                    color: m.role === "user" ? "white" : "#111827",
                    maxWidth: "86%",
                    fontSize: 14,
                    lineHeight: 1.4,
                  }}
                >
                  {m.text}
                </span>
              </div>
            ))}

            {messages.length === 1 && (
              <div style={{ marginTop: 10 }}>
                {quickQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      marginBottom: 8,
                      padding: "9px 10px",
                      borderRadius: 12,
                      border: "1px solid #bfdbfe",
                      background: "#eff6ff",
                      color: "#1e3a8a",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div style={{ fontSize: 13, color: "#475569" }}>
                Cric4All AI is thinking...
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              padding: 10,
              borderTop: "1px solid #e5e7eb",
              background: "white",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              placeholder="Ask Cric4All AI..."
              style={{
                flex: 1,
                padding: 11,
                borderRadius: 12,
                border: "1px solid #cbd5e1",
                outline: "none",
                fontSize: 14,
              }}
            />

            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={loading}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "none",
                background: loading
                  ? "#94a3b8"
                  : "linear-gradient(135deg, #2563eb, #7c3aed)",
                color: "white",
                fontWeight: 800,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}