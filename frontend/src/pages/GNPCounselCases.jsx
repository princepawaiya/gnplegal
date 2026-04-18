import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getGNPCounselCases } from "../services/gnpCounselApi";
import { getUserFromToken } from "../utils/permissions";

export default function GNPCounselCases() {
  const navigate = useNavigate();
  

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  

  useEffect(() => {
    loadCases();
  }, []);

  async function loadCases() {
    try {
      setLoading(true);
      setError("");

      const raw = await getGNPCounselCases();

      console.log("RAW CASES →", raw);

      // ✅ GET CURRENT USER
      const user = getUserFromToken();

      // 🔥 FILTER + MAP
      const mapped = raw.map((r) => {
        console.log("RAW CASE:", r); // ✅ correct place

        return {
          id: r.id,
          case_no: r.case_no,
          matter_name: r.matter_name || "-",
          last_date: r.last_date || r.ldoh || null,
          client: r.client_name || "-",
          forum: r.forum_name || "-",
          stage: r.stage || "-",
          next_date: r.next_date,
          status: r.status || "On Track",
        };
      });

      setRows(mapped);

    } catch (err) {
      console.error("Failed to load GNP Counsel cases", err);
      setError(err.message || "Failed to load cases");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const stageOptions = useMemo(() => {
    return [...new Set(rows.map((r) => r.stage).filter(Boolean))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const q = search.trim().toLowerCase();

      const matchesSearch =
        !q ||
        String(row.case_no || "").toLowerCase().includes(q) ||
        String(row.client || "").toLowerCase().includes(q) ||
        String(row.forum || "").toLowerCase().includes(q) ||
        String(row.stage || "").toLowerCase().includes(q);

      const matchesStatus = !statusFilter || row.status === statusFilter;
      const matchesStage = !stageFilter || row.stage === stageFilter;

      return matchesSearch && matchesStatus && matchesStage;
    });
  }, [rows, search, statusFilter, stageFilter]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      urgent: rows.filter((r) => r.status === "Urgent").length,
      delayed: rows.filter((r) => r.status === "Delayed").length,
      onTrack: rows.filter((r) => r.status === "On Track").length,
    };
  }, [rows]);

  function getStatusStyle(status) {
    switch (status) {
      case "Urgent":
        return {
          background: "#fee2e2",
          color: "#b91c1c",
          border: "1px solid #fecaca",
        };
      case "Delayed":
        return {
          background: "#fef3c7",
          color: "#b45309",
          border: "1px solid #fde68a",
        };
      case "On Track":
        return {
          background: "#dcfce7",
          color: "#15803d",
          border: "1px solid #bbf7d0",
        };
      default:
        return {
          background: "#e5e7eb",
          color: "#374151",
          border: "1px solid #d1d5db",
        };
    }
  }

  function formatDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-IN");
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("");
    setStageFilter("");
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerCard}>
        <div>
          <div style={styles.pageTitle}>GNP Counsel Cases</div>
          <div style={styles.pageSubtext}>
            Track assigned matters, stages, and next hearing dates.
          </div>
        </div>

        <div style={styles.headerActions}>
          <button
            type="button"   // 🔥 prevents form refresh (future safe)
            onClick={() => navigate("/gnp/matters/create")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + New Matter
          </button>

          <button style={styles.secondaryBtn} onClick={loadCases}>
            Refresh
          </button>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <StatCard label="Total Cases" value={stats.total} />
        <StatCard label="Urgent" value={stats.urgent} />
        <StatCard label="Delayed" value={stats.delayed} />
        <StatCard label="On Track" value={stats.onTrack} />
      </div>

      <div style={styles.filterCard}>
        <div style={styles.filterRow}>
          <input
            type="text"
            placeholder="Search by case no, client, forum, stage"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.select}
          >
            <option value="">All Statuses</option>
            <option value="Urgent">Urgent</option>
            <option value="Delayed">Delayed</option>
            <option value="On Track">On Track</option>
          </select>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            style={styles.select}
          >
            <option value="">All Stages</option>
            {stageOptions.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>

          <button style={styles.clearBtn} onClick={resetFilters}>
            Clear
          </button>
        </div>
      </div>

      <div style={styles.tableCard}>
        {error ? (
          <div style={styles.errorBox}>{error}</div>
        ) : loading ? (
          <div style={styles.loadingBox}>Loading cases...</div>
        ) : filteredRows.length === 0 ? (
          <div style={styles.emptyBox}>No cases found.</div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Case No</th>
                  <th style={styles.th}>Matter Name</th>
                  <th style={styles.th}>Client</th>
                  <th style={styles.th}>Forum</th>
                  <th style={styles.th}>Stage</th>
                  <th style={styles.th}>Last Date</th>
                  <th style={styles.th}>Next Date</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} style={styles.tr}>
                    <td style={styles.tdStrong}>{row.case_no || "-"}</td>
                    <td style={styles.td}>{row.matter_name || "-"}</td>
                    <td style={styles.td}>{row.client || "-"}</td>
                    <td style={styles.td}>{row.forum || "-"}</td>
                    <td style={styles.td}>{row.stage || "-"}</td>
                    <td style={styles.td}>{formatDate(row.last_date)}</td>
                    <td style={styles.td}>{formatDate(row.next_date)}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          ...getStatusStyle(row.status),
                        }}
                      >
                        {row.status || "-"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button
                        style={styles.viewBtn}
                        onClick={() => navigate(`/gnp/matters/${row.id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

const styles = {
  page: {
    padding: 24,
    background: "#f8fafc",
    minHeight: "100vh",
    display: "grid",
    gap: 16,
  },

  headerCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },

  pageTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#0f172a",
  },

  pageSubtext: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
  },

  headerActions: {
    display: "flex",
    gap: 10,
  },

  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "var(--text)",
    fontWeight: 600,
    cursor: "pointer",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },

  statCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 16,
  },

  statLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  statValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: 700,
    color: "var(--text)",
  },

  filterCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
  },

  filterRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr auto",
    gap: 12,
  },

  searchInput: {
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    fontSize: 14,
    outline: "none",
  },

  select: {
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    fontSize: 14,
    background: "#ffffff",
    outline: "none",
  },

  clearBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#f8fafc",
    color: "var(--text)",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  tableCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    overflow: "hidden",
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "14px 16px",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    background: "#f8fafc",
    borderBottom: "1px solid #e5e7eb",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    whiteSpace: "nowrap",
  },

  tr: {
    borderBottom: "1px solid #f1f5f9",
  },

  td: {
    padding: "14px 16px",
    fontSize: 14,
    color: "#334155",
    verticalAlign: "middle",
  },

  tdStrong: {
    padding: "14px 16px",
    fontSize: 14,
    color: "#0f172a",
    fontWeight: 700,
    verticalAlign: "middle",
  },

  statusBadge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },

  viewBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "none",
    background: "#111827",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },

  loadingBox: {
    padding: 24,
    color: "#475569",
    fontSize: 14,
  },

  emptyBox: {
    padding: 24,
    color: "#64748b",
    fontSize: 14,
  },

  errorBox: {
    padding: 20,
    margin: 16,
    borderRadius: 12,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    fontSize: 14,
  },
};