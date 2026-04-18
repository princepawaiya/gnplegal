import { useMemo, useState } from "react";

export default function GNPCounselHearings() {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const hearings = [
    {
      id: 1,
      case_no: "HC-1021",
      client: "India Kawasaki Motors Pvt. Ltd.",
      forum: "NCDRC",
      city: "Delhi",
      hearing_date: "2026-04-08",
      purpose: "Admission",
      status: "Upcoming",
    },
    {
      id: 2,
      case_no: "HC-1009",
      client: "Consumer Electronics Matter",
      forum: "SCDRC Delhi",
      city: "Delhi",
      hearing_date: "2026-04-05",
      purpose: "Arguments",
      status: "Today",
    },
    {
      id: 3,
      case_no: "HC-0998",
      client: "Automobile Service Claim",
      forum: "DCDRC Gurugram",
      city: "Gurugram",
      hearing_date: "2026-04-12",
      purpose: "Evidence",
      status: "Upcoming",
    },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return hearings.filter((item) => {
      const matchesSearch =
        !q ||
        item.case_no.toLowerCase().includes(q) ||
        item.client.toLowerCase().includes(q) ||
        item.forum.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q);

      const matchesDate = !dateFilter || item.hearing_date === dateFilter;

      return matchesSearch && matchesDate;
    });
  }, [hearings, search, dateFilter]);

  return (
    <div style={styles.page}>
      <div style={styles.headerCard}>
        <div>
          <div style={styles.pageTitle}>Hearings</div>
          <div style={styles.pageSubtext}>
            Monitor today’s hearings, upcoming appearances and case purposes.
          </div>
        </div>

        <button style={styles.primaryBtn}>Export Schedule</button>
      </div>

      <div style={styles.filterCard}>
        <input
          style={styles.searchInput}
          placeholder="Search by case no, client, forum, city"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <input
          type="date"
          style={styles.searchInput}
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
      </div>

      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Case No</th>
              <th style={styles.th}>Client</th>
              <th style={styles.th}>Forum</th>
              <th style={styles.th}>City</th>
              <th style={styles.th}>Hearing Date</th>
              <th style={styles.th}>Purpose</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" style={styles.empty}>
                  No hearings found.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} style={styles.tr}>
                  <td style={styles.tdStrong}>{item.case_no}</td>
                  <td style={styles.td}>{item.client}</td>
                  <td style={styles.td}>{item.forum}</td>
                  <td style={styles.td}>{item.city}</td>
                  <td style={styles.td}>{formatDate(item.hearing_date)}</td>
                  <td style={styles.td}>{item.purpose}</td>
                  <td style={styles.td}>
                    <span style={getStatusStyle(item.status)}>{item.status}</span>
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
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    display: "inline-block",
  };

  if (status === "Today") {
    return { ...base, background: "#fee2e2", color: "#b91c1c" };
  }

  if (status === "Upcoming") {
    return { ...base, background: "#dbeafe", color: "#1d4ed8" };
  }

  return { ...base, background: "#e5e7eb", color: "#374151" };
}

const styles = {
  page: {
    background: "var(--bg)",
    minHeight: "100vh",
    padding: 24,
    display: "grid",
    gap: 16,
  },
  headerCard: {
    background: "var(--card)",
    border: "1px solid rgba(0,0,0,0.08)",
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
    color: "var(--text)",
  },
  pageSubtext: {
    fontSize: 14,
    color: "var(--subtext)",
    marginTop: 4,
  },
  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "none",
    background: "#111827",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  filterCard: {
    background: "var(--card)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 16,
    padding: 16,
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 12,
  },
  searchInput: {
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    fontSize: 14,
  },
  tableCard: {
    background: "var(--card)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 16,
    overflow: "hidden",
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
    color: "var(--subtext)",
    background: "rgba(0,0,0,0.03)",
  },
  tr: {
    borderTop: "1px solid #f1f5f9",
  },
  td: {
    padding: "14px 16px",
    fontSize: 14,
    color: "var(--text)",
  },
  tdStrong: {
    padding: "14px 16px",
    fontSize: 14,
    fontWeight: 700,
    color: "var(--text)",
  },
  empty: {
    padding: 24,
    textAlign: "center",
    color: "var(--subtext)",
  },
};