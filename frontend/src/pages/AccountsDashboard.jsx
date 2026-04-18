import { useEffect, useState } from "react";
import { getAccountsDashboard } from "../services/api";

function formatCurrency(value) {
  if (!value) return "₹0";
  return "₹" + new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AccountsDashboard() {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const d = await getAccountsDashboard({ year });
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [year]);

  const monthly = data?.monthly || [];

  return (
    <div style={styles.wrapper}>
      {/* HEADER CARD */}
      <div style={styles.headerCard}>
        <div>
          <div style={styles.hTitle}>Accounts Dashboard</div>
          <div style={styles.hSub}>Outstanding • Billing • Collections</div>
        </div>

        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          style={styles.select}
        >
          {Array.from({ length: 6 }).map((_, i) => {
            const y = String(now.getFullYear() - i);
            return (
              <option key={y} value={y}>
                {y}
              </option>
            );
          })}
        </select>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <div style={styles.cardPad}>Loading...</div>
      ) : !data ? (
        <div style={styles.cardPad}>No data available</div>
      ) : (
        <>
          {/* KPI SECTION */}
          <div style={styles.grid3}>
            <Kpi title="Outstanding Total" value={formatCurrency(data.outstanding_total)} />
            <Kpi title="Raised This Month" value={formatCurrency(data.raised_this_month)} />
            <Kpi title="Collected This Month" value={formatCurrency(data.collected_this_month)} />
          </div>

          {/* TABLE */}
          <div style={styles.card}>
            <div style={styles.cardHead}>
              Monthly Summary ({data.year})
            </div>

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.thLeft}>Month</th>
                  <th style={styles.thRight}>Raised</th>
                  <th style={styles.thRight}>Collected</th>
                  <th style={styles.thRight}>Outstanding</th>
                </tr>
              </thead>

              <tbody>
                {monthly.map((m, idx) => (
                  <tr key={idx} style={styles.row}>
                    <td style={styles.monthCell}>{m.month}</td>
                    <td style={styles.tdRight}>{formatCurrency(m.raised)}</td>
                    <td style={styles.tdRight}>{formatCurrency(m.collected)}</td>
                    <td style={styles.tdRight}>{formatCurrency(m.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ title, value }) {
  return (
    <div style={styles.kpi}>
      <div style={styles.kpiTitle}>{title}</div>
      <div style={styles.kpiValue}>{value}</div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "grid",
    gap: 16,
  },

  /* HEADER CARD */
  headerCard: {
    background: "white",
    border: "1px solid #e6e8ef",
    borderRadius: 14,
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  hTitle: {
    fontWeight: 800,
    fontSize: 18,
    color: "#0f172a",
  },

  hSub: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
  },

  select: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    fontWeight: 600,
    cursor: "pointer",
  },

  error: {
    color: "#dc2626",
    fontSize: 13,
  },

  /* KPI GRID */
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },

  kpi: {
    background: "white",
    border: "1px solid #e6e8ef",
    borderRadius: 14,
    padding: 16,
  },

  kpiTitle: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 600,
  },

  kpiValue: {
    fontSize: 22,
    fontWeight: 800,
    marginTop: 6,
    color: "#0f172a",
  },

  /* CARD */
  card: {
    background: "white",
    borderRadius: 14,
    border: "1px solid #e6e8ef",
    overflow: "hidden",
  },

  cardHead: {
    padding: 14,
    borderBottom: "1px solid #f1f5f9",
    fontSize: 13,
    color: "#374151",
    fontWeight: 700,
  },

  cardPad: {
    background: "white",
    borderRadius: 14,
    border: "1px solid #e6e8ef",
    padding: 16,
  },

  /* TABLE */
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  thLeft: {
    textAlign: "left",
    padding: 12,
    fontSize: 12,
    color: "#64748b",
  },

  thRight: {
    textAlign: "right",
    padding: 12,
    fontSize: 12,
    color: "#64748b",
  },

  row: {
    borderTop: "1px solid #f1f5f9",
  },

  monthCell: {
    padding: 12,
    fontWeight: 700,
    color: "#0f172a",
  },

  tdRight: {
    padding: 12,
    textAlign: "right",
    color: "#111827",
    fontWeight: 500,
  },
};