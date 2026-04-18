export default function CounselActivityTimeline({ items = [] }) {
  return (
    <div style={styles.card}>
      <div style={styles.header}>Recent Activity</div>

      {items.length === 0 ? (
        <div style={styles.empty}>No recent activity found.</div>
      ) : (
        <div style={styles.list}>
          {items.map((item, index) => (
            <div key={index} style={styles.row}>
              <div style={styles.dot} />
              <div>
                <div style={styles.title}>{item.title || "Activity update"}</div>
                <div style={styles.meta}>
                  {item.type || "-"} • {formatDateTime(item.time || item.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("en-IN");
}

const styles = {
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
  },

  header: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 14,
  },

  list: {
    display: "grid",
    gap: 14,
  },

  row: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    paddingBottom: 10,
    borderBottom: "1px solid #f8fafc",
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#2563eb",
    marginTop: 6,
    flexShrink: 0,
  },

  title: {
    fontSize: 14,
    fontWeight: 600,
    color: "#0f172a",
  },

  meta: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },

  empty: {
    color: "#94a3b8",
    fontSize: 13,
    padding: "6px 0",
  },
};