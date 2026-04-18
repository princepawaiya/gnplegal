import { useNavigate } from "react-router-dom";

export default function CounselNextActions({ todayData = {} }) {
  const navigate = useNavigate();

  const cards = [
    {
      title: "Urgent Tasks",
      count: todayData?.urgent_tasks?.length || 0,
      desc: "Review immediate case actions and deadlines.",
      color: "#dc2626",
      onClick: () => navigate("/gnp/cases"),
    },
    {
      title: "Today's Hearings",
      count: todayData?.hearings?.length || 0,
      desc: "Check appearance schedule and preparation readiness.",
      color: "#f59e0b",
      onClick: () => navigate("/gnp/hearings"),
    },
    {
      title: "Drafts Pending",
      count: todayData?.drafts?.length || 0,
      desc: "Open pending drafts, pleadings and written work.",
      color: "#2563eb",
      onClick: () => navigate("/gnp/documents"),
    },
    {
      title: "Filings Pending",
      count: todayData?.filings?.length || 0,
      desc: "Track cases requiring filing action.",
      color: "#16a34a",
      onClick: () => navigate("/gnp/cases"),
    },
  ];

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>Execution Panel</div>

      <div style={styles.grid}>
        {cards.map((card) => (
          <button
            key={card.title}
            style={{
              ...styles.card,
              borderTop: `4px solid ${card.color}`,
            }}
            onClick={card.onClick}
          >
            <div style={styles.count}>{card.count}</div>
            <div style={styles.title}>{card.title}</div>
            <div style={styles.desc}>{card.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
    display: "grid",
    gap: 14,
  },

  header: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0f172a",
  },

  grid: {
    display: "grid",
    gap: 12,
  },

  card: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 14,
    textAlign: "left",
    cursor: "pointer",
  },

  count: {
    fontSize: 24,
    fontWeight: 800,
    color: "#111827",
  },

  title: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
  },

  desc: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.5,
  },
};