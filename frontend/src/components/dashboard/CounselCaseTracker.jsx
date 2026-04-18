import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function CounselCaseTracker({ rows = [] }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      return (
        !q ||
        String(row.case_no || "").toLowerCase().includes(q) ||
        String(row.client_name || row.client || "").toLowerCase().includes(q) ||
        String(row.forum_name || row.forum || "").toLowerCase().includes(q) ||
        String(row.stage || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Case Tracker</div>
          <div style={styles.sub}>Monitor assigned matters and next steps.</div>
        </div>

        <input
          type="text"
          placeholder="Search by case, client, forum"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.search}
        />
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Case No</th>
              <th style={styles.th}>Client</th>
              <th style={styles.th}>Forum</th>
              <th style={styles.th}>Stage</th>
              <th style={styles.th}>Next Date</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan="7" style={styles.empty}>
                  No cases found.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} style={styles.tr}>
                  <td style={styles.tdStrong}>{row.case_no || "-"}</td>
                  <td style={styles.td}>{row.client_name || row.client || "-"}</td>
                  <td style={styles.td}>{row.forum_name || row.forum || "-"}</td>
                  <td style={styles.td}>{row.stage || "-"}</td>
                  <td style={styles.td}>{formatDate(row.next_date || row.ndoh)}</td>
                  <td style={styles.td}>
                    <span style={getStatusStyle(row.status || "On Track")}>
                      {row.status || "On Track"}
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-IN");
}

function getStatusStyle(status) {
  const base = {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    display: "inline-block",
  };

  if (status === "Urgent") {
    return { ...base, background: "#fee2e2", color: "#b91c1c" };
  }

  if (status === "Delayed") {
    return { ...base, background: "#fef3c7", color: "#b45309" };
  }

  return { ...base, background: "#dcfce7", color: "#15803d" };
}

const styles = {
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
  },

  header: {
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    borderBottom: "1px solid #f1f5f9",
  },

  title: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0f172a",
  },

  sub: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },

  search: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    minWidth: 280,
  },

  tableWrap: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "14px 16px",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
  },

  tr: {
    borderTop: "1px solid #f1f5f9",
  },

  td: {
    padding: "14px 16px",
    fontSize: 14,
    color: "#334155",
  },

  tdStrong: {
    padding: "14px 16px",
    fontSize: 14,
    color: "#111827",
    fontWeight: 700,
  },

  empty: {
    padding: 24,
    textAlign: "center",
    color: "#94a3b8",
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
};