import { useEffect, useState } from "react";

export default function BareActsDropdown({ value, onChange }) {
  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadActs();
  }, []);

  async function loadActs() {
    try {
      setLoading(true);

      // ✅ FIX 1: USE SAME API AS KNOWLEDGE HUB
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/knowledge?category=bare_act`,
        {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
        }
      );

      const json = await res.json();

      // ✅ FIX 2: NORMALIZE DATA
      const list =
        Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json)
          ? json
          : [];

      console.log("BARE ACTS DROPDOWN:", list);

      setActs(list);
    } catch (e) {
      console.error("Failed to load bare acts", e);
      setActs([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <label style={styles.label}>Select Bare Act</label>

      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        style={styles.select}
      >
        <option value="">-- Select Bare Act --</option>

        {acts.map((act) => (
          <option key={act.id} value={act.id}>
            {/* ✅ FIX 3: USE title (NOT name) */}
            {act.title}
          </option>
        ))}
      </select>

      {loading && <div style={styles.loading}>Loading...</div>}
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
  },
  select: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 14,
  },
  loading: {
    fontSize: 11,
    color: "#64748b",
  },
};