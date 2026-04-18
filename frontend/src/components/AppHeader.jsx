export default function AppHeader() {
  return (
    <div style={styles.header}>
      <img src="/logo.png" alt="GNP Legal" style={styles.logo} />

      <div style={styles.titleBox}>
        <div style={styles.title}>GNP Legal</div>
        <div style={styles.sub}>Consumer Litigation Manager</div>
      </div>
    </div>
  );
}

const styles = {
  header: {
    background: "white",
    padding: "12px 20px",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  logo: {
    height: 45,
    objectFit: "contain",
  },

  titleBox: {
    display: "flex",
    flexDirection: "column",
  },

  title: {
    fontWeight: 800,
    fontSize: 16,
  },

  sub: {
    fontSize: 12,
    color: "#64748b",
  },
};