import { useMemo, useState } from "react";

export default function GNPCounselDocuments() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const documents = [
    {
      id: 1,
      title: "Complaint Draft - HC-1021",
      case_no: "HC-1021",
      client: "India Kawasaki Motors Pvt. Ltd.",
      type: "Complaint",
      updated_at: "2026-04-02",
      status: "Draft Ready",
    },
    {
      id: 2,
      title: "Evidence Bundle - HC-1009",
      case_no: "HC-1009",
      client: "Consumer Electronics Matter",
      type: "Evidence",
      updated_at: "2026-04-01",
      status: "Pending Review",
    },
    {
      id: 3,
      title: "Written Arguments - HC-0998",
      case_no: "HC-0998",
      client: "Automobile Service Claim",
      type: "Written Arguments",
      updated_at: "2026-03-30",
      status: "Filed",
    },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return documents.filter((doc) => {
      const matchesSearch =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.case_no.toLowerCase().includes(q) ||
        doc.client.toLowerCase().includes(q);

      const matchesType = !typeFilter || doc.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [documents, search, typeFilter]);

  return (
    <div style={styles.page}>
      <div style={styles.headerCard}>
        <div>
          <div style={styles.pageTitle}>Documents</div>
          <div style={styles.pageSubtext}>
            Review drafts, pleadings, evidence bundles and filed documents.
          </div>
        </div>

        <button style={styles.primaryBtn}>+ Upload Document</button>
      </div>

      <div style={styles.filterCard}>
        <input
          style={styles.searchInput}
          placeholder="Search by title, case no, client"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          style={styles.select}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="Complaint">Complaint</option>
          <option value="Evidence">Evidence</option>
          <option value="Written Arguments">Written Arguments</option>
        </select>
      </div>

      <div style={styles.grid}>
        {filtered.length === 0 ? (
          <div style={styles.emptyCard}>No documents found.</div>
        ) : (
          filtered.map((doc) => (
            <div key={doc.id} style={styles.docCard}>
              <div style={styles.docTitle}>{doc.title}</div>
              <div style={styles.meta}>Case: {doc.case_no}</div>
              <div style={styles.meta}>Client: {doc.client}</div>
              <div style={styles.meta}>Type: {doc.type}</div>
              <div style={styles.meta}>Updated: {formatDate(doc.updated_at)}</div>

              <div style={styles.footerRow}>
                <span style={getStatusStyle(doc.status)}>{doc.status}</span>

                <div style={styles.actions}>
                  <button style={styles.secondaryBtn}>Open</button>
                  <button style={styles.secondaryBtn}>Download</button>
                </div>
              </div>
            </div>
          ))
        )}
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

  if (status === "Draft Ready") {
    return { ...base, background: "#dbeafe", color: "#1d4ed8" };
  }

  if (status === "Pending Review") {
    return { ...base, background: "#fef3c7", color: "#b45309" };
  }

  if (status === "Filed") {
    return { ...base, background: "#dcfce7", color: "#15803d" };
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
  secondaryBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "var(--card)",
    color: "var(--text)",
    cursor: "pointer",
    fontSize: 13,
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
  select: {
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    fontSize: 14,
    background: "var(--card)",
    color: "var(--text)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
  },
  docCard: {
    background: "var(--card)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
  },
  docTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: 10,
  },
  meta: {
    fontSize: 13,
    color: "var(--subtext)",
    marginBottom: 6,
  },
  footerRow: {
    marginTop: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  actions: {
    display: "flex",
    gap: 8,
  },
  emptyCard: {
    background: "var(--card)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 16,
    padding: 24,
    color: "var(--subtext)",
  },
};