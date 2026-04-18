export default function GNPCounselPerformance() {
  const data = {
    score: 4.5,
    cases: 32,
    avg_days: 45,
    success_rate: 78,
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>Performance Overview</div>

      <div style={styles.grid}>
        <Card label="Performance Score" value={`${data.score} ⭐`} />
        <Card label="Total Cases" value={data.cases} />
        <Card label="Avg Resolution Days" value={`${data.avg_days} days`} />
        <Card label="Success Rate" value={`${data.success_rate}%`} />
      </div>
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div style={styles.card}>
      <div style={styles.label}>{label}</div>
      <div style={styles.value}>{value}</div>
    </div>
  );
}

const styles = {
  page: {
    padding: 20,
    background: "var(--bg)",
    minHeight: "100vh",
  },
  header: {
    fontSize: 20,
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: 20,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  card: {
    background: "var(--card)",
    padding: 18,
    borderRadius: 14,
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },
  label: {
    fontSize: 13,
    color: "var(--subtext)",
  },
  value: {
    fontSize: 20,
    fontWeight: 700,
    color: "var(--text)",
    marginTop: 6,
  },
};