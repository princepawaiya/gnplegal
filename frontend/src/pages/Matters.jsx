import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listMatters,
  exportMattersExcel,
  listClients,
  getUpcomingHearings,
} from "../services/api";
import { hasPermission, getUserFromToken } from "../utils/permissions";
import { listLocalCounsels } from "../services/api";
import { listGnpCounsels } from "../services/api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return isNaN(d) ? "-" : d.toLocaleDateString("en-GB");
}

const styles = {
  wrapper: {
    display: "grid",
    gap: 20,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    fontSize: 22,
    fontWeight: 800,
  },

  subtitle: {
    fontSize: 13,
    color: "#64748b",
  },

  filters: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  input: {
    padding: 10,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    minWidth: 220,
  },

  select: {
    padding: 10,
    borderRadius: 10,
    border: "1px solid #d1d5db",
  },

  card: {
    background: "white",
    borderRadius: 16,
    padding: 16,
    border: "1px solid #e5e7eb",
  },

  row: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    alignItems: "center",
  },

  matterName: {
    fontWeight: 700,
    cursor: "pointer",
  },

  meta: {
    fontSize: 12,
    color: "#6b7280",
  },

  center: {
    textAlign: "center",
  },

  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    background: "#064eeaff",
    color: "white",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
  },

  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    cursor: "pointer",
  },

  empty: {
    textAlign: "center",
    padding: 20,
    color: "#64748b",
  },
  
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
    background: "white",
    padding: 14,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
  },

  searchInput: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    minWidth: 240,
  },

  filterGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  filterLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#6b7280",
  },

  chip: {
    padding: "6px 12px",
    borderRadius: 20,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },

  chipActive: {
    background: "#111827",
    color: "white",
    border: "1px solid #111827",
  },

  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 16,
  },

  matterCard: {
    background: "white",
    borderRadius: 16,
    padding: 16,
    border: "1px solid #e5e7eb",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  cardTitle: {
    fontWeight: 700,
    fontSize: 15,
    color: "#111827",
  },

  cardSub: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },

  cardBody: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

  label: {
    fontSize: 10,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  value: {
    fontSize: 13,
    fontWeight: 600,
    color: "#111827",
  },

  statusBadge: {
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    border: "1px solid #e5e7eb", // 👈 neutral premium look
    background: "#f9fafb",       // 👈 NO color coding
    color: "#374151",
  },

  paginationBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "12px 16px",
  },

  pageInfo: {
    fontSize: 13,
    color: "#6b7280",
  },

  pageControls: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  pageBtn: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    cursor: "pointer",
    fontWeight: 600,
  },

  pageNumber: {
    fontSize: 13,
    fontWeight: 600,
  },

  tableWrapper: {
    background: "white",
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid #e5e7eb",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  tableRow: {
    cursor: "pointer",
    borderBottom: "1px solid #f1f5f9",
  },

  thead: {
    background: "#f9fafb",
  },

  th: {
    textAlign: "left",
    padding: "12px 14px",
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 700,
    borderBottom: "1px solid #e5e7eb",
  },

  td: {
    padding: "12px 14px",
    fontSize: 14,
    borderBottom: "1px solid #f1f5f9",
  },

  matterBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },

  caseNo: {
    fontSize: 12,
    color: "#9ca3af",
  },

  cellText: {
    fontSize: 13,
    color: "#111827",
  },

  hearingPanel: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    display: "grid",
    gap: 12,
  },

  hearingPanelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  hearingPanelTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#111827",
  },

  hearingPanelSub: {
    fontSize: 12,
    color: "#6b7280",
  },

  hearingList: {
    display: "grid",
    gap: 10,
  },

  hearingItem: {
    display: "grid",
    gridTemplateColumns: "120px 1fr auto",
    gap: 14,
    alignItems: "start",
    padding: 12,
    border: "1px solid #eef2f7",
    borderRadius: 12,
    cursor: "pointer",
  },

  hearingDate: {
    fontSize: 13,
    fontWeight: 700,
    color: "#111827",
  },

  hearingBody: {
    display: "grid",
    gap: 4,
  },

  hearingMatter: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111827",
  },

  hearingMeta: {
    fontSize: 12,
    color: "#6b7280",
  },

  hearingSourceBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: "#1e40af",
    background: "#dbeafe",
    borderRadius: 999,
    padding: "6px 10px",
    whiteSpace: "nowrap",
  },

 inlineInput: {
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: "4px 6px",
  fontSize: 12,
  width: "100%",
},

metaLight: {
  fontSize: 11,
  color: "#9ca3af",
},

riskBadge: {
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  marginRight: 6,
},

priorityHigh: {
  background: "#fee2e2",
  color: "#991b1b",
},

priorityMedium: {
  background: "#fef3c7",
  color: "#92400e",
},

priorityLow: {
  background: "#dcfce7",
  color: "#166534",
},

riskRow: {
  border: "1px solid #e5e7eb", // subtle only
},

list: {
  display: "grid",
  gap: 10,
},

matterRowNew: {
  display: "grid",
  gridTemplateColumns: "1.3fr 2fr 1fr 1fr 1fr 1.3fr 1.3fr",
  alignItems: "center",
  padding: "18px 20px",
  borderRadius: 14,
  border: "1px solid #eef2f7",
  background: "#ffffff",
  cursor: "pointer",
  gap: 16,
},

listHeader: {
  display: "grid",
  gridTemplateColumns: "1.3fr 2fr 1fr 1fr 1fr 1.3fr 1.3fr",
  gap: 16,
  padding: "14px 20px",
  borderBottom: "1px solid #e5e7eb",
  background: "#f8fafc",
  fontSize: 12,
  fontWeight: 700,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
},

srNo: {
  fontSize: 13,
  fontWeight: 600,
  color: "#6b7280",
  textAlign: "center",
},

left: {
  display: "flex",
  flexDirection: "column",
  gap: 6,
},

matterTitle: {
  fontSize: 15,
  fontWeight: 700,
  color: "#111827",
},

centerNew: {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minWidth: 160,
  flexWrap: "nowrap",
},

right: {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 24,
},

subMeta: {
  fontSize: 12,
  color: "#9ca3af",
},
}

export default function Matters() {
  const canView = hasPermission("matters:view");
  const canEdit = hasPermission("matters:edit");
  const canAssign = hasPermission("matters:assign");

  if (!canView) {
    return (
      <div style={{ padding: 40 }}>
        <h2>🔒 Access Restricted</h2>
        <p>You do not have permission to view matters.</p>
      </div>
    );
  }
  const navigate = useNavigate();

  const [matters, setMatters] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientFilter, setClientFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [upcomingHearings, setUpcomingHearings] = useState([]);
  const [hearingLoading, setHearingLoading] = useState(true);
  const [counsels, setCounsels] = useState([]);
  const user = getUserFromToken();
  const role = user?.role || "client";
  const [gnpCounsels, setGnpCounsels] = useState([]);

  const basePath =
    role === "admin" ? "/admin" :
    role === "lawyer" ? "/lawyer" :
    "/client";

  const pageSize = 10;

  useEffect(() => {
  
  async function loadCounsels() {
    try {
      const data = await listGnpCounsels();
      setGnpCounsels(data);
    } catch (err) {
      console.error("Failed to load GNP counsels", err);
      setGnpCounsels([]);
    }
  }

    loadCounsels();

    async function loadClients() {
      try {
        const data = await listClients();
        setClients(Array.isArray(data) ? data : data?.data || data?.items || []);
      } catch {
        console.error("Failed to load clients");
      }
    }

    loadClients();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search, clientFilter]);

  async function loadUpcomingHearings() {
    try {
      setHearingLoading(true);

      const data = await getUpcomingHearings({
        days: 7,
        ...(clientFilter ? { client_id: Number(clientFilter) } : {}),
      });

      setUpcomingHearings(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load upcoming hearings", e);
      setUpcomingHearings([]);
    } finally {
      setHearingLoading(false);
    }
  }

  async function refresh() {
    setLoading(true);

    try {
      const filters = {
        page,
        page_size: pageSize,
        search: search?.trim(),
        ...(statusFilter && { current_status: statusFilter })
      };

      if (clientFilter) {
        filters.client_id = Number(clientFilter);
      }

      const response = await listMatters(filters);

      const rows = response?.data || [];

      let sorted = [...rows];

      if (sortBy === "claim_high") {
        sorted = [...sorted].sort(
          (a, b) => (b.claim_amount || 0) - (a.claim_amount || 0)
        );
      }

      if (sortBy === "claim_low") {
        sorted = [...sorted].sort(
          (a, b) => (a.claim_amount || 0) - (b.claim_amount || 0)
        );
      }

      if (sortBy === "ndoh_asc") {
        sorted = [...sorted].sort(
          (a, b) => new Date(a.ndoh || 0) - new Date(b.ndoh || 0)
        );
      }

      if (sortBy === "ndoh_desc") {
        sorted = [...sorted].sort(
          (a, b) => new Date(b.ndoh || 0) - new Date(a.ndoh || 0)
        );
      }

      if (sortBy === "ldoh_asc") {
        sorted = [...sorted].sort(
          (a, b) => new Date(a.ldoh || 0) - new Date(b.ldoh || 0)
        );
      }

      if (sortBy === "allocation_desc") {
        sorted = [...sorted].sort(
          (a, b) =>
            new Date(b.allocation_date || 0) -
            new Date(a.allocation_date || 0)
        );
      }

      setMatters(sorted);
      setTotal(response?.total || 0);
      } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateMatterField(id, value) {
    try {
      await fetch(`${API_BASE}/matters/${id}/update-ldoh`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({ ldoh: value }),
      });

      refresh();
    } catch {
      alert("Update failed");
    }
  }

  async function handleAssignCounsel(matterId, counselId) {
  try {
    const res = await fetch(`${API_BASE}/matters/${matterId}/assign-gnp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify({
        counsel_id: Number(counselId),
      }),
    });

    if (!res.ok) throw new Error("Failed to assign counsel");

    refresh();
  } catch (e) {
    alert(e.message || "Failed to assign counsel");
  }
}

  useEffect(() => {
    refresh();
    loadUpcomingHearings();
  }, [statusFilter, sortBy, page, search, clientFilter]);

  function statusStyle(status) {
    const map = {
      Pending: { bg: "#fef3c7", color: "#92400e" },
      Disposed: { bg: "#d1fae5", color: "#065f46" },
      Allowed: { bg: "#dbeafe", color: "#1e40af" },
      Dismissed: { bg: "#fee2e2", color: "#991b1b" },
    };

    return map[status] || { bg: "#e5e7eb", color: "#374151" };
  }

  function getPriorityStyle(priority) {
    if (priority === "HIGH") return styles.priorityHigh;
    if (priority === "MEDIUM") return styles.priorityMedium;
    return styles.priorityLow;
  }

  return (
    <div style={styles.wrapper}>

      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Matters</div>
          <div style={styles.subtitle}>Control your Litigation. Intelligently</div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {canView && (
            <button
              style={styles.secondaryBtn}
              onClick={async () => {
                try {
                  const blob = await exportMattersExcel();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "matters.xlsx";
                  a.click();
                } catch {
                  alert("Export failed");
                }
              }}
            >
              Export
            </button>
          )}

          {canEdit && (
            <button
              style={styles.primaryBtn}
              onClick={() => navigate(`${basePath}/matters/new`)}
            >
              + Create Matter
            </button>
          )}
        </div>
      </div>

      {/* FILTER BAR (DASHBOARD STYLE) */}
      <div style={styles.filterBar}>

        {/* SEARCH */}
        <input
          placeholder="Search matters..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />

        {/* CLIENT FILTER */}
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>Client</span>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            style={styles.select}
          >
            <option value="">All</option>
            {Array.isArray(clients) &&
              clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.legal_name || c.name || `Client #${c.id}`}
              </option>
            ))}
          </select>
        </div>

        {/* STATUS CHIPS */}
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>Status</span>

          {["Pending", "Allowed", "Disposed", "Dismissed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? "" : s)}
              style={{
                ...styles.chip,
                ...(statusFilter === s ? styles.chipActive : {})
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* SORT */}
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>Sort</span>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={styles.select}
          >
            <option value="">Default</option>
            <option value="claim_high">Claim ↓</option>
            <option value="claim_low">Claim ↑</option>
            <option value="ndoh_asc">NDOH ↑</option>
            <option value="ndoh_desc">NDOH ↓</option>
          </select>
        </div>

      </div>

      
      {/* UPCOMING HEARINGS */}
      <div style={styles.hearingPanel}>
        <div style={styles.hearingPanelHeader}>
          <div style={styles.hearingPanelTitle}>Upcoming Hearings</div>
          <div style={styles.hearingPanelSub}>Next 7 days</div>
        </div>

        {hearingLoading ? (
          <div style={styles.empty}>Loading upcoming hearings...</div>
        ) : upcomingHearings.length === 0 ? (
          <div style={styles.empty}>No upcoming hearings in the selected range.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={styles.th}>Client Name</th>
                  <th style={styles.th}>Matter</th>
                  <th style={styles.th}>Forum Name</th>
                  <th style={styles.th}>LDOH</th>
                  <th style={styles.th}>NDOH</th>
                  <th style={styles.th}>Purpose</th>
                  <th style={styles.th}>GNP Counsel</th>
                  <th style={styles.th}>Location Counsel</th>
                </tr>
              </thead>

              <tbody>
                {upcomingHearings.slice(0, 8).map((h, idx) => (
                  <tr
                    key={`${h.matter_id}-${h.ndoh}-${idx}`}
                    style={{
                      cursor: canView ? "pointer" : "not-allowed",
                      opacity: canView ? 1 : 0.6,
                      borderBottom: "1px solid #f1f5f9",
                    }}
                    onClick={() => {
                      if (!h.matter_id || !canView) return;
                      navigate(`${basePath}/matters/${h.matter_id}`);
                    }}
                  >
                    <td style={styles.td}>{h.client_name || "-"}</td>
                    <td style={styles.td}>{h.matter_name || "-"}</td>
                    <td style={styles.td}>{h.forum_name || h.forum || "-"}</td>
                    <td style={styles.td}>{formatDate(h.ldoh)}</td>
                    <td style={styles.td}>{formatDate(h.ndoh)}</td>
                    <td style={styles.td}>{h.purpose || h.stage || "-"}</td>
                    <td style={styles.td}>{h.gnp_counsel || "-"}</td>
                    <td style={styles.td}>{h.local_counsel || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* LIST */}
      <div style={styles.card}>
        {loading ? (
  <div style={styles.empty}>Loading...</div>
        ) : matters.length === 0 ? (
          <div style={styles.empty}>
            No matters found. Create your first case.
          </div>
        ) : (
          
          <div style={styles.tableWrapper}>
            <div style={styles.listHeader}>
              <div>Client Name</div>
              <div>Matter Name</div>
              <div>Case Status</div>
              <div>LDOH</div>
              <div>NDOH</div>
              <div>GNP Counsel</div>
              <div>Location Counsel</div>
            </div>

            <div style={styles.list}>
              {matters.map((m) => {
                return (
                  <div
                    key={m.id}
                    style={{
                      ...styles.matterRowNew,
                      ...(m.is_overdue || m.is_stale ? styles.riskRow : {}),
                      opacity: canView ? 1 : 0.6,
                    }}
                    onClick={() => {
                      if (!canView) return;
                      navigate(`${basePath}/matters/${m.id}`);
                    }}
                  >
                    <div>
                      <div style={styles.value}>{m.client_name || "-"}</div>
                      <div style={styles.subMeta}>{m.forum || "-"}</div>
                    </div>

                    <div>
                      <div style={styles.matterTitle}>
                        {m.matter_name || "Untitled Matter"}
                      </div>
                      <div style={styles.meta}>{m.case_no || "-"}</div>
                    </div>

                    <div>
                      <div style={styles.value}>{m.case_status || "-"}</div>
                      <div style={styles.subMeta}>{m.priority || "-"}</div>
                    </div>

                    <div style={styles.value}>{formatDate(m.ldoh)}</div>

                    <div style={styles.value}>{formatDate(m.ndoh)}</div>

                    <div onClick={(e) => e.stopPropagation()}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                        {m.gnp_counsel || "-"}
                      </div>

                      {canAssign && (
                        <select
                          value={m.gnp_lawyer_id || ""}
                          style={{ ...styles.inlineInput, marginTop: 8 }}
                          onChange={(e) => handleAssignCounsel(m.id, e.target.value)}
                        >
                          <option value="">Assign GNP Counsel</option>
                          {gnpCounsels.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.full_name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                      {m.local_counsel || "-"}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={styles.paginationBar}>
              <div style={styles.pageInfo}>
                {total === 0 ? (
                  "No records"
                ) : (
                  <>
                    Showing {(page - 1) * pageSize + 1} -{" "}
                    {Math.min(page * pageSize, total)} of {total}
                  </>
                )}
              </div>

              <div style={styles.pageControls}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={styles.pageBtn}
                >
                  ← Prev
                </button>

                <div style={styles.pageNumber}>Page {page}</div>

                <button
                  onClick={() =>
                    setPage((p) => (p * pageSize < total ? p + 1 : p))
                  }
                  disabled={page * pageSize >= total}
                  style={styles.pageBtn}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    );
}