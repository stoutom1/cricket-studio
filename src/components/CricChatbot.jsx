"use client";

import { useState } from "react";

export default function CricChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi! I’m Cric4All AI. Ask me about live scoring, match setup, extras, wickets, teams, leagues, stats, or spectator links.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [bubbleVisible, setBubbleVisible] = useState(true);

  async function sendMessage(customText) {
    const text = (customText || input).trim();
    if (!text || loading) return;

    setInput("");
    setBubbleVisible(false);
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

  function openChat() {
    setOpen(true);
    setBubbleVisible(false);
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
          0% { transform: scale(1); box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35); }
          50% { transform: scale(1.04); box-shadow: 0 10px 32px rgba(37, 99, 235, 0.55); }
          100% { transform: scale(1); box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35); }
        }

        .cric-ai-button {
          animation: cricAiPulse 2.5s ease-in-out infinite;
        }

        .cric-ai-button:hover {
          transform: translateY(-2px) scale(1.03);
        }

        @media (max-width: 520px) {
          .cric-ai-panel {
            right: 10px !important;
            left: 10px !important;
            bottom: 82px !important;
            width: auto !important;
            height: 72vh !important;
          }

          .cric-ai-button {
            right: 12px !important;
            bottom: 14px !important;
            padding: 13px 16px !important;
            font-size: 14px !important;
          }

          .cric-ai-bubble {
            right: 12px !important;
            bottom: 72px !important;
            width: 230px !important;
          }
        }
      `}</style>

      {!open && bubbleVisible && (
        <div
          className="cric-ai-bubble"
          style={{
            position: "fixed",
            right: 18,
            bottom: 76,
            width: 260,
            zIndex: 9998,
            background: "linear-gradient(135deg, #ffffff, #eff6ff)",
            color: "#0f172a",
            border: "1px solid rgba(59,130,246,0.35)",
            borderRadius: 16,
            padding: "12px 14px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
            fontSize: 13,
            lineHeight: 1.35,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>
            👋 Need help?
          </div>
          <div>
            Ask Cric4All AI about scoring, leagues, matches, or cricket rules.
          </div>
        </div>
      )}

      <button
        type="button"
        className="cric-ai-button"
        onClick={openChat}
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          zIndex: 9999,
          border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: "999px",
          padding: "14px 20px",
          background: "linear-gradient(135deg, #2563eb, #7c3aed)",
          color: "white",
          fontWeight: 900,
          fontSize: 15,
          cursor: "pointer",
          letterSpacing: "0.2px",
        }}
      >
        🏏 Ask Cric4All AI
      </button>

      {open && (
        <div
          className="cric-ai-panel"
          style={{
            position: "fixed",
            right: 18,
            bottom: 82,
            width: "min(390px, calc(100vw - 28px))",
            height: 540,
            background: "white",
            color: "#111827",
            borderRadius: 18,
            boxShadow: "0 12px 40px rgba(0,0,0,0.38)",
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            border: "1px solid rgba(59,130,246,0.35)",
          }}
        >
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
              placeholder="Ask about scoring, teams, matches..."
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