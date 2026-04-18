import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast.jsx";
import { getUserFromToken } from "../utils/permissions";

const API = "http://localhost:8000";

function safeDate(d) {
  if (!d) return null;

  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
}

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [client, setClient] = useState(null);
  const [matters, setMatters] = useState([]);
  const [tab, setTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [spocs, setSpocs] = useState([]);
  const user = getUserFromToken();

  const basePath =
    user?.role === "admin"
      ? "/admin"
      : user?.role === "lawyer"
      ? "/lawyer"
      : "/client";

  async function load() {
    try {
      const token = localStorage.getItem("token");
      const clientId = encodeURIComponent(String(id || ""));

      if (!clientId) {
        throw new Error("Invalid client id");
      }

      const clientUrl = `${API}/clients/${clientId}`;
      const mattersUrl = `${API}/clients/${clientId}/matters`;

      console.log("CLIENT URL →", clientUrl);
      console.log("MATTERS URL →", mattersUrl);

      const [clientRes, mattersRes] = await Promise.all([
        fetch(clientUrl, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(mattersUrl, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const clientText = await clientRes.text();
      const mattersText = await mattersRes.text();

      if (!clientRes.ok) {
        throw new Error(
          `Client fetch failed (${clientRes.status}): ${clientText || "No response"}`
        );
      }

      if (!mattersRes.ok) {
        throw new Error(
          `Matters fetch failed (${mattersRes.status}): ${mattersText || "No response"}`
        );
      }

      const clientData = clientText ? JSON.parse(clientText) : null;
      const mattersData = mattersText ? JSON.parse(mattersText) : [];

      setClient(clientData);
      setForm(clientData || {});
      setSpocs(Array.isArray(clientData?.spocs) ? clientData.spocs : []);
      setMatters(Array.isArray(mattersData) ? mattersData : []);
    } catch (e) {
      console.error("CLIENT DETAIL LOAD ERROR →", e);
      toast.push({
        variant: "error",
        title: "Error",
        message: e.message || "Failed to load client details",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
  try {
    const token = localStorage.getItem("token");

    const clientId = encodeURIComponent(String(id || ""));

    const res = await fetch(`${API}/clients/${clientId}/update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: form.legal_name || "",
        spocs: spocs.map((s) => ({
          spoc_name: s.name || s.spoc_name || "",
          email: s.email || "",
          phone: s.mobile || s.phone || "",
        })),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Update failed");
    }

    toast.push({
      variant: "success",
      title: "Saved",
      message: "Client updated successfully",
    });

    setEditMode(false);
    load();
  } catch (e) {
    toast.push({
      variant: "error",
      title: "Save failed",
      message: e.message,
    });
  }
}

  useEffect(() => {
    load();
  }, [id]);

  const analytics = useMemo(() => {
  const total = matters.length;

  const active = matters.filter(m => !m.is_disposed).length;
  const disposed = matters.filter(m => m.is_disposed).length;

  const totalClaim = matters.reduce((sum, m) => sum + (m.claim_amount || 0), 0);

  const avgClaim = total ? Math.round(totalClaim / total) : 0;

  const upcoming = matters
    .filter(m => safeDate(m.ndoh))
    .sort((a, b) => safeDate(a.ndoh) - safeDate(b.ndoh))[0];

  const lastHearing = matters
    .filter(m => safeDate(m.ldoh))
    .sort((a, b) => safeDate(b.ldoh) - safeDate(a.ldoh))[0];

  const statusMap = {};
  matters.forEach(m => {
    const s = m.current_status || "Unknown";
    statusMap[s] = (statusMap[s] || 0) + 1;
  });

  const topStatus = Object.entries(statusMap).sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    total,
    active,
    disposed,
    totalClaim,
    avgClaim,
    upcoming,
    lastHearing,
    topStatus,
  };
}, [matters]);

const risks = useMemo(() => {
  const today = new Date();

  let overdue = 0;
  let stale = 0;
  let highValue = 0;

  matters.forEach((m) => {
    // 🚨 Overdue hearing
    const nd = safeDate(m.ndoh);
    if (nd && nd < today && !m.is_disposed) {
      overdue++;
    }

    // 🚨 No update in 30 days
    const ld = safeDate(m.ldoh);
    if (ld) {
      const diff = (today - ld) / (1000 * 60 * 60 * 24);
      if (diff > 30) stale++;
    }

    // 🚨 High claim (>5 lakh)
    if ((m.claim_amount || 0) > 500000) {
      highValue++;
    }
  });

  return { overdue, stale, highValue };
}, [matters]);

  if (loading) return <div style={styles.empty}>Loading...</div>;
  if (!client) return <div style={styles.empty}>Client not found</div>;

  function renderField(label, key) {
  return (
    <div>
      <div style={styles.label}>{label}</div>

      {editMode ? (
        <input
          value={form[key] || ""}
          onChange={(e) =>
            setForm({ ...form, [key]: e.target.value })
          }
          style={styles.input}
        />
      ) : (
        <div style={styles.value}>{form[key] || "-"}</div>
      )}
    </div>
  );
}

function updateSpoc(index, field, value) {
  const copy = [...spocs];
  copy[index] = { ...copy[index], [field]: value };
  setSpocs(copy);
}

function StatCard({ label, value, color }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statValue, color: color || "#111827" }}>
        {value}
      </div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function RiskCard({ label, value, color }) {
  return (
    <div style={{ ...styles.riskCard, borderLeft: `4px solid ${color}` }}>
      <div style={styles.riskValue}>{value}</div>
      <div style={styles.riskLabel}>{label}</div>
    </div>
  );
}

  return (
    <div style={{ display: "grid", gap: 18 }}>

      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <div style={styles.title}>{client.legal_name}</div>
          <div style={styles.subtitle}>{client.client_type || "-"}</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
        <button
        onClick={() => navigate("/clients")}
        style={styles.secondaryBtn}
        >
        ← Back
        </button>

        <button
            onClick={() => setEditMode(!editMode)}
            style={styles.primaryBtn}
        >
            {editMode ? "Cancel" : "Edit"}
        </button>
        </div>
        
      </div>

      <div style={styles.analyticsGrid}>
        <StatCard label="Total Matters" value={analytics.total} />
        <StatCard label="Active" value={analytics.active} color="#16a34a" />
        <StatCard label="Disposed" value={analytics.disposed} />
        <StatCard label="Total Claim" value={`₹ ${(analytics.totalClaim || 0).toLocaleString()}`} />
        <StatCard label="Avg Claim" value={`₹ ${(analytics.avgClaim || 0).toLocaleString()}`} />
        </div>

        <div style={styles.analyticsPanel}>
        <div style={styles.insightRow}>
            <span>📅 Next Hearing:</span>
            <b>{analytics.upcoming?.ndoh
                ? safeDate(analytics.upcoming?.ndoh)?.toLocaleDateString("en-IN") || "-"
                : "-"}</b>
        </div>

        <div style={styles.insightRow}>
            <span>🕘 Last Hearing:</span>
            <b>{analytics.lastHearing?.ldoh
            ? safeDate(analytics.lastHearing?.ldoh)?.toLocaleDateString("en-IN") || "-"
            : "-"}</b>
        </div>

        <div style={styles.insightRow}>
            <span>📊 Dominant Status:</span>
            <b>{analytics.topStatus || "-"}</b>
        </div>
        </div>

        <div style={styles.riskGrid}>
        {risks.overdue > 0 && (
            <RiskCard
            label="Overdue Hearings"
            value={risks.overdue}
            color="#dc2626"
            />
        )}

        {risks.stale > 0 && (
            <RiskCard
            label="No Update >30 Days"
            value={risks.stale}
            color="#f59e0b"
            />
        )}

        {risks.highValue > 0 && (
            <RiskCard
            label="High Value Cases"
            value={risks.highValue}
            color="#7c3aed"
            />
        )}

        {risks.overdue === 0 && risks.stale === 0 && risks.highValue === 0 && (
            <div style={styles.noRisk}>
            ✅ No critical risks detected
            </div>
        )}
        </div>

      {/* TABS */}
      <div style={styles.tabs}>
        {["profile", "spocs", "matters", "billing"].map((t) => (
          <div
            key={t}
            onClick={() => setTab(t)}
            style={{
              ...styles.tab,
              ...(tab === t ? styles.activeTab : {}),
            }}
          >
            {t.toUpperCase()}
          </div>
        ))}
      </div>

      {/* CONTENT CARD */}
      <div style={styles.card}>

        {/* PROFILE */}
        {tab === "profile" && (
          <div style={styles.grid}>
            {renderField("Legal Name", "legal_name")}
            {renderField("Type", "client_type")}
            {renderField("Registered Address", "registered_address")}
            {renderField("Corporate Address", "corporate_address")}
            {renderField("Billing Address", "billing_address")}
            {renderField("PAN", "pan")}
            {renderField("Contact Person", "contact_name")}
            {renderField("Designation", "designation")}
          </div>
        )}

        {/* SPOCS */}
        {tab === "spocs" && (
          <div style={{ display: "grid", gap: 10 }}>
            {spocs.length === 0 && (
              <div style={styles.empty}>No SPOCs added</div>
            )}

            {editMode && tab !== "matters" && tab !== "billing" && (
            <button
                onClick={() =>
                setSpocs([...spocs, { name: "", email: "", mobile: "" }])
                }
                style={styles.secondaryBtn}
            >
                + Add SPOC
            </button>
            )}

            {spocs.map((s, i) => (
                <div key={i} style={styles.spocRow}>
                    <input
                    disabled={!editMode}
                    value={s.name || s.spoc_name || ""}
                    onChange={(e) => updateSpoc(i, "name", e.target.value)}
                    placeholder="Name"
                    style={styles.input}
                    />
                    <input
                    disabled={!editMode}
                    value={s.email || ""}
                    onChange={(e) => updateSpoc(i, "email", e.target.value)}
                    placeholder="Email"
                    style={styles.input}
                    />
                    <input
                    disabled={!editMode}
                    value={s.mobile || s.phone || ""}
                    onChange={(e) => updateSpoc(i, "mobile", e.target.value)}
                    placeholder="Mobile"
                    style={styles.input}
                    />
                </div>
            ))}
          </div>
        )}

        {editMode && tab !== "matters" && tab !== "billing" && (
        <div style={{ marginTop: 16 }}>
            <button onClick={handleSave} style={styles.primaryBtn}>
            Save Changes
            </button>
        </div>
        )}

        {/* MATTERS */}
        {tab === "matters" && (
          <div style={{ display: "grid", gap: 10 }}>
            {matters.length === 0 && (
              <div style={styles.empty}>No matters available</div>
            )}

            {matters.map((m) => {
              const priority = getPriority(m); // ✅ FIX

              return (
                <div
                  key={m.id}
                  style={{ ...styles.matterRow, cursor: "pointer" }}
                  onClick={() => navigate(`${basePath}/matters/${m.id}`)}
                >
                  <div style={styles.matterMeta}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        background: `${priority.color}20`,
                        color: priority.color,
                      }}
                    >
                      {priority.label}
                    </span>
                  </div>

                  <div>
                    <div style={styles.matterTitle}>{m.matter_name}</div>
                    <div style={styles.matterSub}>{m.case_no}</div>
                  </div>

                  <div style={styles.matterMeta}>
                    {m.current_status || "-"}
                  </div>

                  <div style={styles.matterMeta}>
                    {m.ndoh || "-"}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* BILLING */}
        {tab === "billing" && (
          <div style={styles.empty}>
            Billing module coming next 🚀
          </div>
        )}

      </div>
    </div>
  );
}

/* ROW COMPONENT */
function Row({ label, value }) {
  return (
    <div>
      <div style={styles.label}>{label}</div>
      <div style={styles.value}>{value || "-"}</div>
    </div>
  );
}

function getPriority(m) {
  const today = new Date();
  const nd = safeDate(m.ndoh);

  if (nd && nd < today && !m.is_disposed) {
    return { label: "High", color: "#dc2626" };
  }

  if ((m.claim_amount || 0) > 500000) {
    return { label: "Medium", color: "#f59e0b" };
  }

  return { label: "Normal", color: "#16a34a" };
}

/* STYLES */

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: { fontSize: 20, fontWeight: 800 },
  subtitle: { fontSize: 12, color: "#64748b" },

  tabs: {
    display: "flex",
    gap: 16,
    borderBottom: "1px solid #e2e8f0",
  },

  tab: {
    padding: "8px 0",
    cursor: "pointer",
    fontSize: 13,
    color: "#64748b",
  },

  activeTab: {
    borderBottom: "2px solid black",
    fontWeight: 700,
    color: "#111827",
  },

  card: {
    background: "white",
    borderRadius: 14,
    padding: 18,
    border: "1px solid #e2e8f0",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },

  label: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },

  value: {
    fontWeight: 600,
  },

  spocCard: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },

  spocName: {
    fontWeight: 700,
  },

  spocMeta: {
    fontSize: 12,
    color: "#64748b",
  },

  matterRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
  },

  matterTitle: {
    fontWeight: 700,
  },

  matterSub: {
    fontSize: 12,
    color: "#64748b",
  },

  matterMeta: {
    fontSize: 13,
    color: "#334155",
  },

  primaryBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    background: "#111827",
    color: "white",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },

  secondaryBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    cursor: "pointer",
  },

  empty: {
    textAlign: "center",
    color: "#64748b",
    padding: 20,
  },

  input: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    width: "100%",
    },

  spocRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
    },

  analyticsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
    },

  statCard: {
    padding: 16,
    borderRadius: 12,
    background: "linear-gradient(135deg, #f8fafc, #ffffff)",
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    transition: "0.2s",
    },

  statValue: {
    fontSize: 20,
    fontWeight: 800,
    color: "#111827",
    },

  statLabel: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
    },

  analyticsPanel: {
    padding: 16,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 12,
    },

  insightRow: {
    display: "flex",
    gap: 6,
    fontSize: 13,
    },

 riskGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
},

riskCard: {
  padding: 14,
  borderRadius: 10,
  background: "#fff",
  border: "1px solid #e2e8f0",
},

riskValue: {
  fontSize: 18,
  fontWeight: 800,
},

riskLabel: {
  fontSize: 12,
  color: "#64748b",
},

noRisk: {
  padding: 14,
  borderRadius: 10,
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  textAlign: "center",
  fontWeight: 600,
  color: "#065f46",
},
};