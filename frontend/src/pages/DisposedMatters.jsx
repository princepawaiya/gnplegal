import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listMatters } from "../services/api";
import * as XLSX from "xlsx";

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GB");
}

function formatCurrency(value) {
  if (!value) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DisposedMatters() {
  const navigate = useNavigate();
  const [matters, setMatters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await listMatters({
        current_status: "Allowed,Disposed,Dismissed",
        page: 1,
        page_size: 1000,
      });

      const enriched = (res.data || []).map((m) => ({
        ...m,
        outcome: m.outcome || "",
        client_share: m.client_share || 0,
        client_savings: m.client_savings || 0,
        isEditing: false, // ✅ FIXED
      }));

      setMatters(enriched);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveMIS(matter) {
  try {
    await fetch(
      `/matters/${matter.id}/update-outcome`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          outcome: matter.outcome,
          client_share: matter.client_share,
          client_savings: matter.client_savings,
        }),
      }
    );

    setMatters((prev) =>
      prev.map((m) =>
        m.id === matter.id
          ? { ...m, isEditing: false }
          : m
      )
    );

  } catch {
    alert("Failed to save MIS data");
  }
}

  async function updateOutcome(matterId, outcomeValue) {
    try {
        await fetch(
        `/matters/${matterId}/update-outcome`,
        {
            method: "PUT",
            headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({
            outcome: outcomeValue,
            }),
        }
        );

        setMatters((prev) =>
        prev.map((m) => {
            if (m.id === matterId) {
            const updated = { ...m, outcome: outcomeValue };

            // 🔹 Recalculate immediately
            const claim = updated.claim_amount || 0;
            const share = updated.client_share || 0;

            if (outcomeValue === "Favour" || outcomeValue === "Settled") {
                updated.client_savings = claim - share;
            } else {
                updated.client_savings = 0;
            }

            return updated;
            }
            return m;
        })
        );

    } catch (err) {
        alert("Failed to update outcome");
    }
    }

  /* ================= OUTCOME LOGIC ================= */

  function handleOutcomeChange(index, value) {
    const updated = [...matters];
    updated[index].outcome = value;

    calculateMIS(updated, index);
    setMatters(updated);
  }

  function handleShareChange(index, value) {
    const updated = [...matters];
    const share = Number(value) || 0;

    updated[index].client_share = share;

    const claim = updated[index].claim_amount || 0;
    const outcome = updated[index].outcome;

    if (outcome === "Favour" || outcome === "Settled") {
        updated[index].client_savings = claim - share;
    } else {
        updated[index].client_savings = 0;
    }

    setMatters(updated);
    }

  function calculateMIS(data, index) {
    const matter = data[index];
    const claim = matter.claim_amount || 0;
    const share = matter.client_share || 0;

    if (matter.outcome === "Favour" || matter.outcome === "Settled") {
      matter.client_savings = claim - share;
    } else if (matter.outcome === "Against") {
      matter.client_savings = 0;
    } else {
      matter.client_savings = 0;
    }
  }

  /* ================= EXPORT EXCEL ================= */

  function exportDisposedExcel() {
    if (matters.length === 0) {
      alert("No disposed matters to export.");
      return;
    }

    const formattedData = matters.map((m) => ({
      "Internal Case No": m.internal_case_no,
      Client: m.client,
      "Matter Name": m.matter_name,
      "Case No": m.case_no,
      Forum: m.forum,
      Status: m.current_status,
      Outcome: m.outcome,
      "Claim Amount": m.claim_amount,
      "Client Share": m.client_share,
      "Client Savings": m.client_savings,
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Disposed Matters");

    XLSX.writeFile(workbook, "disposed_matters.xlsx");
  }

  /* ================= TOTAL FOOTER ================= */

  const totalClaim = matters.reduce(
    (sum, m) => sum + (m.claim_amount || 0),
    0
  );

  const totalShare = matters.reduce(
    (sum, m) => sum + (m.client_share || 0),
    0
  );

  const totalSavings = matters.reduce(
    (sum, m) => sum + (m.client_savings || 0),
    0
  );

  return (
  <div style={styles.wrapper}>
    <div style={styles.container}>

      {/* HEADER CARD */}
      <div style={styles.headerCard}>
        <div>
          <div style={styles.title}>Disposed Matters</div>
          <div style={styles.sub}>Outcome • Savings • MIS</div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={exportDisposedExcel} style={styles.primaryBtn}>
            Export
          </button>

          <button onClick={() => navigate(-1)} style={styles.secondaryBtn}>
            Back
          </button>
        </div>
      </div>

      {/* TABLE CARD */}
      <div style={styles.card}>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Matter</th>
                  <th>Client</th>
                  <th>Forum</th>
                  <th>Status</th>
                  <th>Claim</th>
                  <th>Outcome</th>
                  <th>Share</th>
                  <th>Savings</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {matters.map((m, i) => (
                  <tr key={m.id}>
                    <td>{i + 1}</td>

                    <td
                      style={styles.link}
                      onClick={() => navigate(`/matters/${m.id}`)}
                    >
                      {m.matter_name || m.internal_case_no}
                    </td>

                    <td>{m.client}</td>
                    <td>{m.forum}</td>

                    <td style={styles.status}>{m.current_status}</td>

                    <td>{formatCurrency(m.claim_amount)}</td>

                    {/* OUTCOME */}
                    <td>
                      <select
                        value={m.outcome || ""}
                        onChange={(e) => {
                          const value = e.target.value;

                          setMatters(prev =>
                            prev.map(x => {
                              if (x.id !== m.id) return x;

                              const updated = { ...x, outcome: value };

                              const claim = updated.claim_amount || 0;
                              const share = updated.client_share || 0;

                              updated.client_savings =
                                value === "Favour" || value === "Settled"
                                  ? claim - share
                                  : 0;

                              return updated;
                            })
                          );
                        }}
                        style={styles.select}
                      >
                        <option value="">Select</option>
                        <option value="Favour">Favour</option>
                        <option value="Against">Against</option>
                        <option value="Settled">Settled</option>
                        <option value="Pending">Restore</option>
                      </select>
                    </td>

                    {/* SHARE */}
                    <td>
                      <input
                        type="number"
                        value={m.client_share}
                        disabled={!m.isEditing}
                        onChange={(e) => handleShareChange(i, e.target.value)}
                        style={styles.input}
                      />
                    </td>

                    {/* SAVINGS */}
                    <td style={styles.savings}>
                      {formatCurrency(m.client_savings)}
                    </td>

                    {/* ACTION */}
                    <td>
                      {m.isEditing ? (
                        <button onClick={() => saveMIS(m)} style={styles.primaryBtn}>
                          Save
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            setMatters(prev =>
                              prev.map(x =>
                                x.id === m.id ? { ...x, isEditing: true } : x
                              )
                            )
                          }
                          style={styles.secondaryBtn}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {/* FOOTER */}
                <tr style={styles.footer}>
                  <td colSpan="5">TOTAL</td>
                  <td>{formatCurrency(totalClaim)}</td>
                  <td></td>
                  <td>{formatCurrency(totalShare)}</td>
                  <td>{formatCurrency(totalSavings)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  </div>
);
}

const styles = {
  primaryBtn: {
    padding: "10px 20px",
    background: "#111827",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },

  secondaryBtn: {
    padding: "10px 20px",
    background: "white",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },

  wrapper: {
    background: "#f8fafc",
    minHeight: "100vh",
    padding: 24,
  },

  container: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "grid",
    gap: 16,
  },

  headerCard: {
    background: "white",
    border: "1px solid #e6e8ef",
    borderRadius: 14,
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    fontSize: 18,
    fontWeight: 800,
  },

  sub: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },

  card: {
    background: "white",
    border: "1px solid #e6e8ef",
    borderRadius: 14,
    padding: 16,
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  link: {
    cursor: "pointer",
    fontWeight: 700,
    color: "#1d4ed8",
  },

  status: {
    color: "#16a34a",
    fontWeight: 700,
  },

  select: {
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
  },

  input: {
    width: 100,
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
  },

  savings: {
    fontWeight: 700,
    color: "#059669",
  },

  footer: {
    fontWeight: 800,
    background: "#f1f5f9",
  },

  primaryBtnSmall: {
    padding: "6px 10px",
    borderRadius: 8,
    background: "#1d4ed8",
    color: "white",
    border: "none",
    cursor: "pointer",
  },

  secondaryBtnSmall: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "white",
    cursor: "pointer",
  },
};