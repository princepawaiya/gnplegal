import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL;

export default function ClientDashboard() {
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
    let role = "client";

    try {
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        role = payload?.role || "client";
      }
    } catch {
      role = "client";
    }

  const basePath =
    role === "admin" ? "/admin" :
    role === "lawyer" ? "/lawyer" :
    "/client";

  const [matters, setMatters] = useState([]);
  const [hearings, setHearings] = useState([]);

  useEffect(() => {
    loadMatters();
    loadHearings();
  }, []);

  async function loadMatters() {
    try {
      const res = await fetch(`${API_BASE}/matters/list`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      if (!res.ok) throw new Error("Failed to fetch matters");

      const data = await res.json();
      setMatters(data.data || []);
    } catch {
      console.error("Failed to load matters");
    }
  }

  async function loadHearings() {
    try {
      const res = await fetch(`${API_BASE}/matters/upcoming-hearings?days=7`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      if (!res.ok) throw new Error("Failed to fetch hearings");

      const data = await res.json();
      setHearings(data || []);
    } catch {
      console.error("Failed to load hearings");
    }
  }

  const pending = matters.filter((m) => m.current_status === "Pending").length;
  const disposed = matters.filter((m) => m.current_status !== "Pending").length;

  return (
    <div style={styles.wrapper}>

      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.title}>My Cases</div>
        <div style={styles.subtitle}>
          Track your complaints and legal progress
        </div>
      </div>

      {/* SUMMARY */}
      <div style={styles.summaryGrid}>
        <Card title="Total Cases" value={matters.length} />
        <Card title="Pending" value={pending} />
        <Card title="Resolved" value={disposed} />
      </div>

      {/* UPCOMING HEARINGS */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Upcoming Hearings</div>

        {hearings.length === 0 ? (
          <div style={styles.empty}>No upcoming hearings</div>
        ) : (
          hearings.map((h, i) => (
            <div key={i} style={styles.hearingCard}>
              <div style={styles.hearingTitle}>
                {h.matter_name}
              </div>

              <div style={styles.meta}>
                Case No: {h.case_no}
              </div>

              <div style={styles.meta}>
                Next Date: {formatDate(h.ndoh)}
              </div>

              <div style={styles.meta}>
                Purpose: {h.purpose || "—"}
              </div>
            </div>
          ))
        )}
      </div>

      {/* CASE LIST */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>All Cases</div>
    
        {matters.length === 0 && (
            <div style={styles.empty}>No cases found</div>
          )}
        {matters.map((m) => (
          <div
            key={m.id}
            style={styles.caseCard}
            onClick={() => navigate(`${basePath}/matters/${m.id}`)}
          >
            <div style={styles.caseHeader}>
              <div style={styles.caseTitle}>
                {m.matter_name}
              </div>

              <div style={statusStyle(m.current_status)}>
                {m.current_status}
              </div>
            </div>

            <div style={styles.meta}>Case No: {m.case_no}</div>

            <div style={styles.meta}>
              Next Hearing: {formatDate(m.ndoh)}
            </div>

            <div style={styles.meta}>
              Forum: {m.forum}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* COMPONENTS */

function Card({ title, value }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardValue}>{value}</div>
      <div style={styles.cardLabel}>{title}</div>
    </div>
  );
}

function formatDate(d) {
  if (!d) return "-";
  const date = new Date(d);
  return isNaN(date) ? "-" : date.toLocaleDateString("en-GB");
}

function statusStyle(status) {
  const map = {
    Pending: { background: "#fef3c7", color: "#92400e" },
    Allowed: { background: "#dbeafe", color: "#1e40af" },
    Disposed: { background: "#d1fae5", color: "#065f46" },
    Dismissed: { background: "#fee2e2", color: "#991b1b" },
  };

  return {
    ...styles.status,
    ...(map[status] || {}),
  };
}

/* STYLES */

const styles = {
  wrapper: { display: "grid", gap: 20 },

  header: {},
  title: { fontSize: 22, fontWeight: 800 },
  subtitle: { fontSize: 13, color: "#6b7280" },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },

  card: {
    background: "white",
    padding: 16,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    textAlign: "center",
  },

  cardValue: { fontSize: 20, fontWeight: 700 },
  cardLabel: { fontSize: 12, color: "#6b7280" },

  section: {
    background: "white",
    padding: 16,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 10,
  },

  hearingCard: {
    borderBottom: "1px solid #f1f5f9",
    padding: "8px 0",
  },

  hearingTitle: {
    fontWeight: 600,
  },

  caseCard: {
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    marginBottom: 10,
    cursor: "pointer",
  },

  caseHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  caseTitle: {
    fontWeight: 600,
  },

  meta: {
    fontSize: 12,
    color: "#6b7280",
  },

  empty: {
    fontSize: 12,
    color: "#9ca3af",
  },

  status: {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
  },
};