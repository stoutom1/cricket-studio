export default function StatsPage() {
  return (
    <main
      style={{
        maxWidth: "900px",
        margin: "40px auto",
        padding: "20px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          padding: "60px 20px",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          background: "#f9fafb",
        }}
      >
        <h1
          style={{
            marginBottom: "16px",
          }}
        >
          📈 Statistics
        </h1>

        <p
          style={{
            fontSize: "18px",
            color: "#6b7280",
            marginBottom: "20px",
          }}
        >
          This page is currently under development.
        </p>

        <p
          style={{
            color: "#9ca3af",
          }}
        >
          Upcoming features will include:
        </p>

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            marginTop: "20px",
            lineHeight: "2",
          }}
        >
          <li>🏏 Batting Statistics</li>
          <li>🎯 Bowling Statistics</li>
          <li>📊 Team Performance Analytics</li>
          <li>🏆 League Leaderboards</li>
          <li>⭐ Player Rankings</li>
          <li>📈 Match Trends & Insights</li>
        </ul>

        <div
          style={{
            marginTop: "30px",
            padding: "12px",
            background: "#eff6ff",
            borderRadius: "8px",
            color: "#1d4ed8",
          }}
        >
          🚧 We're actively working on this feature.
          Check back soon for updates!
        </div>
      </div>
    </main>
  );
}