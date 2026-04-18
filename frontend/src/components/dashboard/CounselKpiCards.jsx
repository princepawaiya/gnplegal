export default function CounselKpiCards({ summary = {} }) {
  const cards = [
    {
      label: "Active Cases",
      value: summary.active_cases || 0,
    },
    {
      label: "Filed This Month",
      value: summary.filed_this_month || 0,
    },
    {
      label: "Pending Actions",
      value: summary.pending_actions || 0,
    },
    {
      label: "Upcoming Hearings",
      value: summary.upcoming_hearings || 0,
    },
    {
      label: "Revenue Generated",
      value: formatCurrency(summary.revenue_generated || 0),
    },
    {
      label: "Performance Score",
      value: summary.performance_score || 0,
    },
  ];

  return (
    <div style={styles.grid}>
      {cards.map((card) => (
        <div key={card.label} style={styles.card}>
          <div style={styles.label}>{card.label}</div>
          <div style={styles.value}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
  },

  label: {
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  value: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: 800,
    color: "#111827",
  },
};