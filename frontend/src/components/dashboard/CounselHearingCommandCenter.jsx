import { useNavigate } from "react-router-dom";

export default function CounselHearingCommandCenter({ rows = [] }) {
  const navigate = useNavigate();

  const hearings = rows
    .filter((row) => row.ndoh)
    .map((row) => {
      const today = startOfDay(new Date());
      const hearingDate = startOfDay(new Date(row.ndoh));
      const diffDays = Math.round(
        (hearingDate - today) / (1000 * 60 * 60 * 24)
      );

      let urgency = "Upcoming";
      if (diffDays <= 0) urgency = "Today";
      else if (diffDays <= 3) urgency = "Soon";

      return {
        id: row.id,
        matter_name: row.matter_name || "-",
        forum:
          row.forum_name ||
          row.forum ||
          (typeof row.forum === "object" ? row.forum?.name : "-") ||
          "-",
        ndoh: row.ndoh,
        diffDays,
        urgency,
      };
    })
    .filter((row) => row.diffDays >= 0)
    .sort((a, b) => new Date(a.ndoh) - new Date(b.ndoh))
    .slice(0, 8);

  function getStyle(urgency) {
    switch (urgency) {
      case "Today":
        return {
          border: "1px solid #fecaca",
          background: "#fef2f2",
          badge: { background: "#dc2626", color: "#fff" },
        };
      case "Soon":
        return {
          border: "1px solid #fde68a",
          background: "#fffbeb",
          badge: { background: "#f59e0b", color: "#fff" },
        };
      default:
        return {
          border: "1px solid #e0e7ff",
          background: "#f8fafc",
          badge: { background: "#2563eb", color: "#fff" },
        };
    }
  }

  return (
    <div style={styles.card}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.title}>Hearing Command Center</div>

        <button
          style={styles.viewAll}
          onClick={() => navigate("/gnp/hearings")}
        >
          View Full Calendar →
        </button>
      </div>

      {/* CONTENT */}
      {hearings.length === 0 ? (
        <div style={styles.empty}>No upcoming hearings</div>
      ) : (
        <div style={styles.list}>
          {hearings.map((hearing) => {
            const style = getStyle(hearing.urgency);

            return (
              <div
                key={hearing.id}
                style={{
                  ...styles.row,
                  ...style,
                }}
                onClick={() => navigate(`/gnp/cases/${hearing.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 18px rgba(0,0,0,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {/* LEFT */}
                <div style={styles.left}>
                  <div style={styles.matter}>
                    {hearing.matter_name}
                  </div>

                  <div style={styles.meta}>
                    {hearing.forum}
                  </div>

                  <div style={styles.days}>
                    {hearing.urgency === "Today"
                      ? "⚡ Hearing Today"
                      : `${hearing.diffDays} day(s) left`}
                  </div>
                </div>

                {/* RIGHT */}
                <div style={styles.right}>
                  <div style={styles.date}>
                    {formatDate(hearing.ndoh)}
                  </div>

                  <div style={{ ...styles.badge, ...style.badge }}>
                    {hearing.urgency}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================= HELPERS ================= */

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  return isNaN(d) ? "-" : d.toLocaleDateString("en-IN");
}

/* ================= STYLES ================= */

const styles = {
  card: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 18,
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  title: {
    fontWeight: 700,
    fontSize: 16,
    color: "#0f172a",
  },

  viewAll: {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },

  list: {
    display: "grid",
    gap: 12,
  },

  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  left: {
    display: "grid",
    gap: 4,
  },

  right: {
    display: "grid",
    justifyItems: "end",
    gap: 6,
  },

  matter: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
  },

  meta: {
    fontSize: 12,
    color: "#64748b",
  },

  days: {
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
  },

  date: {
    fontSize: 13,
    fontWeight: 600,
    color: "#0f172a",
  },

  badge: {
    padding: "4px 10px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },

  empty: {
    textAlign: "center",
    padding: 20,
    fontSize: 13,
    color: "#94a3b8",
  },
};