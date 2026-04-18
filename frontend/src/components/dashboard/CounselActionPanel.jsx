import { useNavigate } from "react-router-dom";

export default function CounselActionPanel({ todayData }) {
  const navigate = useNavigate();

  const sections = [
    {
      title: "Urgent Tasks",
      items: todayData.urgent_tasks,
      color: "#dc2626",
      action: () => navigate("/gnp/cases"),
    },
    {
      title: "Today's Hearings",
      items: todayData.hearings,
      color: "#f59e0b",
      action: () => navigate("/gnp/hearings"),
    },
    {
      title: "Drafts Pending",
      items: todayData.drafts,
      color: "#2563eb",
      action: () => navigate("/gnp/documents"),
    },
    {
      title: "Filings Pending",
      items: todayData.filings,
      color: "#16a34a",
      action: () => navigate("/gnp/cases"),
    },
  ];

  function handleItemClick(item, section) {
    if (item?.matter_id) {
      navigate(`/gnp/cases/${item.matter_id}`);
    } else {
      section.action();
    }
  }

  return (
    <div style={styles.wrapper}>
      {sections.map((section, index) => (
        <div
          key={index}
          style={{
            ...styles.card,
            borderTop: `4px solid ${section.color}`,
          }}
        >
          {/* HEADER */}
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <div style={{ ...styles.dot, background: section.color }} />
              <div style={styles.title}>{section.title}</div>
            </div>

            <div style={styles.count}>
              {section.items?.length || 0}
            </div>
          </div>

          {/* LIST */}
          <div style={styles.list}>
            {section.items && section.items.length > 0 ? (
              section.items.slice(0, 3).map((item, i) => (
                <div
                  key={i}
                  style={styles.item}
                  onClick={() => handleItemClick(item, section)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f8fafc";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  {/* TITLE */}
                  <div style={styles.itemTitle}>
                    {item.title || item.case_no || item}
                  </div>

                  {/* META */}
                  {typeof item === "object" && (
                    <div style={styles.itemMeta}>
                      {item.client_name || "-"} •{" "}
                      {item.forum || item.city || "-"}
                    </div>
                  )}

                  {/* EXTRA INFO */}
                  {typeof item === "object" && (
                    <div style={styles.itemExtra}>
                      {item.next_date && (
                        <span>📅 {formatDate(item.next_date)}</span>
                      )}
                      {item.stage && <span>• {item.stage}</span>}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={styles.empty}>No items</div>
            )}
          </div>

          {/* FOOTER */}
          <div style={styles.footer}>
            <button style={styles.button} onClick={section.action}>
              View All →
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================= HELPERS ================= */

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("en-IN");
}

/* ================= STYLES ================= */

const styles = {
  wrapper: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
  },

  card: {
    background: "#ffffff",
    borderRadius: 16,
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: 190,
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
    transition: "all 0.2s ease",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
  },

  title: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
  },

  count: {
    fontSize: 12,
    fontWeight: 600,
    background: "#f1f5f9",
    padding: "4px 8px",
    borderRadius: 8,
  },

  list: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  item: {
    padding: "10px",
    borderRadius: 10,
    cursor: "pointer",
    transition: "all 0.2s ease",
    border: "1px solid transparent",
  },

  itemTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#0f172a",
  },

  itemMeta: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },

  itemExtra: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 4,
    display: "flex",
    gap: 6,
  },

  empty: {
    fontSize: 12,
    color: "#94a3b8",
  },

  footer: {
    marginTop: 10,
  },

  button: {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};