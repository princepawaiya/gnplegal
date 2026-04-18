import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { classifyAlert } from "../utils/alertEngine";

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  let role = "admin";

  try {
    role = JSON.parse(atob(token.split(".")[1])).role;
  } catch {}

  const basePath =
    role === "admin" ? "/admin" :
    role === "lawyer" ? "/lawyer" :
    "/client";

  useEffect(() => {
    loadAlerts();
  }, []);

  async function loadAlerts() {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`${import.meta.env.VITE_API_URL}/alerts/matters`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    const sorted = (data.items || []).sort((a, b) => {
      return classifyAlert(a).priority - classifyAlert(b).priority;
    });

    setAlerts(sorted);

  } catch (err) {
    console.error("Failed to load alerts");
  } finally {
    setLoading(false);
  }
}

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div style={styles.title}>Alerts & Risks</div>
        <div style={styles.subtitle}>
          Monitor critical litigation issues
        </div>
      </div>

      {loading ? (
        <div style={styles.empty}>Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div style={styles.empty}>No alerts 🎉</div>
      ) : (
        <div style={styles.list}>
          {alerts.map((a, i) => {
            const intelligence = classifyAlert(a);

            return (
              <div key={i} style={styles.card}>
                <div
                style={{
                    ...styles.badge,
                    background: intelligence.color,
                }}
                >
                {intelligence.label}
                </div>

                <div style={styles.info}>
                  <div style={styles.matter}>
                    {a.matter_name || "Matter"}
                  </div>

                  <div style={styles.desc}>
                    {a.message || a.type}
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/admin/matters/${item.matter_id}`)}
                  style={{ cursor: "pointer" }}
                >
                  Open
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    padding: 24,
  },

  header: {
    marginBottom: 20,
  },

  title: {
    fontSize: 22,
    fontWeight: 800,
    color: "#111827",
  },

  subtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
  },

  list: {
    display: "grid",
    gap: 14,
  },

  card: {
    background: "white",
    padding: 16,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    color: "white",
    fontSize: 11,
    fontWeight: 700,
  },

  info: {
    flex: 1,
  },

  matter: {
    fontWeight: 700,
    color: "#111827",
  },

  desc: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
  },

  button: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    cursor: "pointer",
  },

  empty: {
    textAlign: "center",
    padding: 40,
    color: "#6b7280",
  },
};