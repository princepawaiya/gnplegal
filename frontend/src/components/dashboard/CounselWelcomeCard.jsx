import { useEffect, useState } from "react";
import { getUserFromToken } from "../../utils/permissions";

export default function CounselWelcomeCard() {
  const [user, setUser] = useState(null);
  const [greeting, setGreeting] = useState("");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    const u = getUserFromToken();
    setUser(u);

    const hour = new Date().getHours();

    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    const options = { weekday: "long", day: "numeric", month: "long" };
    setDateStr(new Date().toLocaleDateString("en-IN", options));
  }, []);

  function getWorkMessage() {
    const hour = new Date().getHours();

    if (hour < 12) {
      return "Start strong. Prioritize hearings and filings for the day.";
    }
    if (hour < 17) {
      return "Stay on track. Ensure timely updates across all matters.";
    }
    return "Wrap up pending actions and prepare for tomorrow.";
  }

  return (
    <div style={styles.card}>
      <div style={styles.left}>
        <div style={styles.greeting}>
          {greeting}
          {user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""} 👋
        </div>

        <div style={styles.subText}>{dateStr}</div>

        <div style={styles.message}>{getWorkMessage()}</div>

        {/* 🔥 NEW: Quick Insight Row */}
        <div style={styles.chips}>
          <div style={styles.chip}>⚖️ Active Cases</div>
          <div style={styles.chip}>📅 Hearings Today</div>
          <div style={styles.chip}>⚡ Pending Actions</div>
        </div>
      </div>

      <div style={styles.right}>
        <div style={styles.statBox}>
          <div style={styles.statNumber}>⚖️</div>
          <div style={styles.statLabel}>Stay Sharp</div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: "linear-gradient(135deg, #ffffff, #f8fafc)",
    borderRadius: 16,
    padding: "20px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
    border: "1px solid #e2e8f0",
  },

  left: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  greeting: {
    fontSize: 20,
    fontWeight: 600,
    color: "var(--text)",
  },

  subText: {
    fontSize: 13,
    color: "var(--subtext)",
  },

  message: {
    marginTop: 8,
    fontSize: 14,
    color: "#334155",
  },

  chips: {
    display: "flex",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
  },

  chip: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "#e2e8f0",
    color: "#1e293b",
    fontWeight: 500,
  },

  right: {
    display: "flex",
    alignItems: "center",
  },

  statBox: {
    background: "#0f172a",
    color: "#ffffff",
    padding: "14px 18px",
    borderRadius: 14,
    textAlign: "center",
  },

  statNumber: {
    fontSize: 22,
  },

  statLabel: {
    fontSize: 12,
    opacity: 0.8,
  },
};