import { useState } from "react";

export default function GNPCounselSettings() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function handleSave() {
    alert("Settings saved (API to be connected)");
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>Settings</div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Profile Information</div>

        <input
          name="name"
          placeholder="Full Name"
          value={form.name}
          onChange={handleChange}
          style={styles.input}
        />

        <input
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          style={styles.input}
        />

        <input
          name="phone"
          placeholder="Phone"
          value={form.phone}
          onChange={handleChange}
          style={styles.input}
        />

        <button style={styles.button} onClick={handleSave}>
          Save Changes
        </button>
      </div>
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
  card: {
    background: "var(--card)",
    padding: 20,
    borderRadius: 14,
    maxWidth: 400,
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  sectionTitle: {
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: 6,
  },
  input: {
    padding: "10px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    fontSize: 14,
  },
  button: {
    marginTop: 10,
    background: "#111827",
    color: "#fff",
    padding: "10px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
  },
};