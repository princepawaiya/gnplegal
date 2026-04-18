import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { listMatters } from "../services/api";
import { hasPermission, getUserFromToken } from "../utils/permissions";
import AppHeader from "../components/AppHeader";
import { getAdminOverview } from "../services/api";
import { getControlTower } from "../services/api";
import {
  getGNPCounselSummary,
  getGNPCounselCases,
  getExecutionPanel,
  getPerformanceScore,
  getPriorityCases,
  getAlerts,
} from "../services/gnpCounselApi";

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getUserFromToken();
  const role = user?.role || "client";

  // ✅ PAGE LEVEL PERMISSION
  if (!hasPermission("dashboard:view")) {
    return <div style={{ padding: 20 }}>Access Denied</div>;
  }

  const [uploading, setUploading] = useState(false);

  const basePath =
    role === "admin"
      ? "/admin"
      : role === "lawyer"
      ? "/gnp"
      : "/client";

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    disposed: 0,
  });

  const [upcomingHearings, setUpcomingHearings] = useState([]);

  const [matters, setMatters] = useState([]);
  const [counselList, setCounselList] = useState([]);
  const [selectedCounsel, setSelectedCounsel] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [controlData, setControlData] = useState(null);
  const [execution, setExecution] = useState(null);
  const [performance, setPerformance] = useState(0);
  const [priorityCases, setPriorityCases] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [actionQueue, setActionQueue] = useState([]);

  useEffect(() => {
    loadCounselData();
  }, []);

  async function loadCounselData() {
    try {
      const res = await getGNPCounselSummary();

      const list =
        Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
          ? res.data
          : [];

      console.log("GNP COUNSELS →", list);

      setCounselList(list);
    } catch (err) {
      console.error("Failed to load counsel data", err);
      setCounselList([]);
    }
  }

  async function loadHearings() {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/matters/upcoming-hearings`, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    const data = await res.json();
    setUpcomingHearings(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error("Failed to load hearings", e);
    setUpcomingHearings([]);
  }
}

  async function loadStats() {
  try {
    const res = await listMatters({ page_size: 200 });
    const matters =
    Array.isArray(res)
      ? res
      : Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res?.items)
      ? res.items
      : [];

    setStats({
      total: matters.length,
      pending: matters.filter((m) => m.current_status === "Pending").length,
      disposed: matters.filter((m) =>
        ["Disposed", "Allowed", "Dismissed"].includes(m.current_status)
      ).length,
    });
  } catch (e) {
    console.error("Failed to load dashboard stats", e);
    setStats({
      total: 0,
      pending: 0,
      disposed: 0,
    });
  }
}

async function loadMatters() {
  try {
    const res = await getGNPCounselCases();

    const data =
      Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.items)
        ? res.items
        : [];

    setMatters(data);
  } catch (e) {
    console.error("Failed to load matters", e);
    setMatters([]);
  }
}

async function loadAdminData() {
  try {
    const res = await getAdminOverview();
    setAdminData(res?.data || null);
  } catch (e) {
    console.error("Failed to load admin data", e);
    setAdminData(null);
  }
}

async function loadControlTower() {
  try {
    const res = await getControlTower();
    setControlData(res?.data || null);
  } catch (e) {
    console.error("Control tower failed", e);
    setControlData(null);
  }
}

async function loadExecution() {
  try {
    const res = await getExecutionPanel();
    setExecution(res?.data || null);
  } catch {
    setExecution(null);
  }
}

async function loadPerformance() {
  try {
    const res = await getPerformanceScore();
    setPerformance(res?.score || 0);
  } catch {
    setPerformance(0);
  }
}

async function loadPriorityCases() {
  try {
    const res = await getPriorityCases();
    setPriorityCases(res?.data || []);
  } catch {
    setPriorityCases([]);
  }
}

async function loadAlerts() {
  try {
    const res = await getAlerts();
    setAlerts(res);
  } catch {
    setAlerts([]);
  }
}

async function loadActionQueue() {
  try {
    const res = await getGNPCounselCases();

    // 🔥 FILTER ONLY ACTIONABLE CASES
    const actions = res
      .filter((c) => c.next_action && c.priority !== "LOW")
      .sort((a, b) => {
        const priorityRank = { HIGH: 1, MEDIUM: 2, LOW: 3 };
        return (priorityRank[a.priority] || 4) - (priorityRank[b.priority] || 4);
      })
      .slice(0, 10);

    setActionQueue(actions);
  } catch {
    setActionQueue([]);
  }
}

useEffect(() => {
  loadStats();
  loadHearings();
  loadMatters();

  if (role === "admin") {
    loadAdminData();
    loadControlTower();
  }

  if (role === "lawyer") {
    loadExecution();
    loadPerformance();
    loadPriorityCases();
    loadAlerts();        // ✅ NEW
    loadActionQueue();
  }
}, []);

  const cards = [
    hasPermission("view_clients") && {
      title: "Clients",
      desc: "Manage clients + SPOCs",
      to: `${basePath}/clients`,
      icon: "🏢",
    },
    hasPermission("matters:view") && {
      title: "Matters",
      desc: "Create & track matters",
      to: `${basePath}/matters`,
      icon: "⚖️",
    },
    hasPermission("view_mis") && {
      title: "MIS",
      desc: "Summaries & reports",
      to: `${basePath}/mis`,
      icon: "📈",
    },
    hasPermission("view_invoices") && {
      title: "Invoices",
      desc: "Generate and manage invoices",
      to: `${basePath}/invoices`,
      icon: "🧾",
    },
    hasPermission("view_cause_list") && {
      title: "Cause List",
      desc: "Weekly & Monthly hearings",
      to: `${basePath}/cause-list`,
      icon: "📅",
    },
  ].filter(Boolean); // ✅ removes false items

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return isNaN(d) ? "-" : d.toLocaleDateString("en-GB");
}

  return (
    <div style={styles.wrapper}>
        <AppHeader />   {/* ✅ ADD THIS */}

      <div style={styles.container}>
        {/* HEADER */}
        <div style={styles.headerCard}>
          <div>
            <div style={styles.title}>
              {role === "admin" && "Admin Dashboard"}
              {role === "lawyer" && "GNP Counsel Dashboard"}
              {role === "client" && "Client Dashboard"}
            </div>
            <div style={styles.sub}>Consumer Litigation Manager</div>
          </div>

          <div style={styles.actions}>
            {/* IMPORT */}
            {hasPermission("edit_matters") && (
              <button
                disabled={uploading}
                onClick={() => navigate(`${basePath}/import-matters`)}
                style={{
                  ...styles.secondaryBtn,
                  opacity: uploading ? 0.6 : 1,
                  cursor: uploading ? "not-allowed" : "pointer"
                }}
              >
                {uploading ? "Uploading..." : "Import"}
              </button>
            )}

            {/* NEW MATTER */}
            {hasPermission("edit_matters") && (
              <button
                onClick={() => navigate(`${basePath}/matters/new`)}
                style={styles.primaryBtn}
              >
                + Create Matter
              </button>
            )}
          </div>
        </div>

        {role === "lawyer" && (
          <div style={styles.controlBar}>
            <KPI title="🚨 Alerts" value={alerts.length} />
            <KPI title="⚡ Urgent" value={execution?.urgent || 0} />
            <KPI title="📅 Today" value={execution?.today_hearings || 0} />
            <KPI title="📊 Score" value={performance} />
          </div>
        )}

        {/* KPI */}
        <div style={styles.kpiGrid}>
          {role === "admin" && adminData ? (
            <>
              <KPI title="Total Cases" value={adminData.matters.total} />
              <KPI title="Active" value={adminData.matters.active} />
              <KPI title="Disposed" value={adminData.matters.disposed} />
              <KPI title="Clients" value={adminData.clients} />
              <KPI title="Revenue" value={`₹${adminData.revenue}`} />
            </>
          ) : (
            <>
              <KPI title="Total Cases" value={stats.total} />
              <KPI title="Pending" value={stats.pending} />
              <KPI title="Disposed" value={stats.disposed} />
            </>
          )}
        </div>

        {role === "lawyer" && (
          <div style={styles.mainGrid}>

            {/* LEFT - ACTION QUEUE */}
            <div style={{ flex: 2 }}>
              <div style={styles.panel}>
                <div style={styles.panelTitle}>⚡ Action Queue</div>

                {actionQueue.length === 0 ? (
                  <div style={styles.empty}>No actions pending</div>
                ) : (
                  actionQueue.map((c) => (
                    <div
                      key={c.id}
                      style={styles.actionCard}
                      onClick={() => navigate(`${basePath}/matters/${c.id}`)}
                    >
                      <div style={styles.actionTop}>
                        <span>{c.case_no}</span>

                        <span style={styles.priorityBadge(c.priority)}>
                          {c.priority}
                        </span>
                      </div>

                      <div style={styles.meta}>
                        {c.client_name} • {c.forum_name}
                      </div>

                      <div style={styles.nextAction}>
                        ⚡ {c.next_action || "No action"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* RIGHT - ALERTS */}
            <div style={{ flex: 1 }}>
              <div style={styles.panel}>
                <div style={styles.panelTitle}>🚨 Alerts</div>

                {alerts.length === 0 ? (
                  <div style={styles.empty}>No alerts 🎉</div>
                ) : (
                  alerts.map((a, i) => (
                    <div key={i} style={styles.alertCard}>
                      <div style={{ fontWeight: 700 }}>{a.case_no}</div>
                      <div style={styles.meta}>{a.message}</div>
                    </div>
                  ))
                )}
              </div>

              {/* 👉 ADD StickyTasks here */}
              <StickyTasks compact />
            </div>

          </div>
        )}

        {role === "lawyer" && execution && (
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Execution Panel</div>

            <div style={styles.kpiGrid}>
              <KPI title="Urgent Tasks" value={execution.urgent} />
              <KPI title="Today's Hearings" value={execution.today_hearings} />
              <KPI title="Drafts Pending" value={execution.drafts_pending} />
              <KPI title="Filings Pending" value={execution.filings_pending} />
            </div>
          </div>
        )}

        {role === "admin" && controlData && (
          <>
            {/* 🔴 ALERTS */}
            <div style={styles.panel}>
              <div style={styles.panelTitle}>Critical Alerts</div>

              <div style={styles.kpiGrid}>
                <KPI title="Missed Hearings" value={controlData.alerts.missed_hearings} />
                <KPI title="Stale Cases (7d)" value={controlData.alerts.stale_cases} />
              </div>
            </div>

            {/* 🟡 ACTIONS */}
            <div style={styles.panel}>
              <div style={styles.panelTitle}>Action Required</div>

              <div style={styles.kpiGrid}>
                <KPI title="No Next Date" value={controlData.actions.no_next_date} />
                <KPI title="No Counsel Assigned" value={controlData.actions.no_counsel} />
              </div>
            </div>

            {/* 🟢 PERFORMANCE */}
            <div style={styles.panel}>
              <div style={styles.panelTitle}>Performance Insights</div>

              <div style={styles.panelGrid}>
                <div>
                  <div style={{ fontWeight: 700 }}>Top Lawyers</div>
                  {controlData?.performance?.top_lawyers || [].map((l) => (
                    <div key={l.id} style={styles.meta}>
                      {l.name} — {l.cases} disposed
                    </div>
                  ))}
                </div>

                <div>
                  <div style={{ fontWeight: 700 }}>Slow / High Pending</div>
                  {controlData?.performance?.slow_lawyers || [].map((l) => (
                    <div key={l.id} style={styles.meta}>
                      {l.name} — {l.pending} pending
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}


        {role === "admin" && adminData && (
          <div style={styles.panel}>
            <div style={styles.panelTitle}>System Alerts</div>

            <div style={styles.kpiGrid}>
              <KPI title="Today's Hearings" value={adminData.hearings.today} />
              <KPI title="Overdue Cases" value={adminData.hearings.overdue} />
            </div>
          </div>
        )}
        {selectedCounsel && (
          <div style={styles.counselBox}>

            <div style={styles.counselTitle}>
              {selectedCounsel.name}
            </div>

            <div style={styles.statsGrid}>

              <Stat label="Total Cases" value={selectedCounsel.total} />
              <Stat label="Pending" value={selectedCounsel.pending} />
              <Stat label="Upcoming" value={selectedCounsel.upcoming} />
              <Stat label="Missed" value={selectedCounsel.missed} />
              <Stat label="Closed" value={selectedCounsel.closed} />

            </div>

            <div style={styles.stageBox}>
              <div style={styles.stageTitle}>Stage Breakdown</div>

              {selectedCounsel.stage_breakdown.map((s, i) => (
                <div key={i} style={styles.stageRow}>
                  <span>{s.stage || "Unknown"}</span>
                  <span>{s.count}</span>
                </div>
              ))}

            </div>

          </div>
        )}
        {role === "lawyer" && (
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Priority Cases</div>

            {priorityCases.length === 0 ? (
              <div style={styles.empty}>No priority cases</div>
            ) : (
              priorityCases.map((c) => (
                <div key={c.id} style={styles.priorityCard}>
                  <div style={styles.actionTop}>
                    <span>{c.case_no}</span>
                    <span style={styles.priorityBadge(c.priority)}>
                      {c.priority}
                    </span>
                  </div>

                  <div style={styles.meta}>{c.client}</div>

                  <div style={styles.meta}>
                    📅 {formatDate(c.next_date)} ({c.days_left} days)
                  </div>
                </div>
              ))
            )}
          </div>
        )}

         {role === "lawyer" && hasPermission("matters:view") && (
            <div style={styles.section}>
              <div style={styles.panelTitle}>My Assigned Cases</div>

              {matters.length === 0 ? (
                <div style={styles.empty}>No assigned cases</div>
              ) : (
                <div style={styles.list}>
                  {matters.map((m) => (
                    <div
                      key={m.id}
                      style={styles.caseRow}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                      onClick={() => navigate(`${basePath}/matters/${m.id}`)}
                    >
                      {/* MATTER NAME */}
                      <div style={{ fontWeight: 700 }}>
                        {m.matter_name || "Untitled Matter"}
                      </div>

                      {/* CLIENT + FORUM */}
                      <div style={styles.meta}>
                        {m.client_name || "-"} • {m.forum_name || "-"}
                      </div>

                      {/* CASE NO */}
                      <div style={styles.meta}>
                        Case No: {m.case_no || "-"}
                      </div>

                      {/* DATES */}
                      <div style={styles.meta}>
                        NDOH: {formatDate(m.next_date)} | LDOH: {formatDate(m.last_date)}
                      </div>

                      {/* ✅ GNP COUNSEL */}
                      <div style={styles.meta}>
                        👤 GNP: {m.gnp_counsel || "-"}
                      </div>

                      {/* ✅ LOCATION COUNSEL */}
                      <div style={styles.meta}>
                        ⚖️ Location: {m.location_counsel || "-"}
                      </div>

                      {/* STATUS */}
                      <div style={styles.meta}>
                        Status: {m.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        {/* QUICK NAV */}
        <div style={styles.grid}>
          {cards.map((c) => (
            <div
              key={c.title}
              style={styles.card}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "none";
              }}
              onClick={() => navigate(c.to)}
            >
              <div style={styles.icon}>{c.icon}</div>
              <div>
                <div style={styles.cardTitle}>{c.title}</div>
                <div style={styles.cardDesc}>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {hasPermission("matters:view") && (
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Upcoming Hearings</div>

            {upcomingHearings.length === 0 ? (
              <div style={styles.empty}>No upcoming hearings</div>
            ) : (
              upcomingHearings.slice(0, 5).map((h, idx) => (
                <div key={idx} style={styles.hearingRow}>
                  <div>{formatDate(h.ndoh)}</div>
                  <div>{h.matter_name}</div>
                  <div>{h.forum}</div>
                </div>
              ))
            )}
          </div>
        )}

        {role === "lawyer" && (
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Performance Snapshot</div>

            <div style={styles.kpiGrid}>
              <KPI title="Performance Score" value={performance} />
              <KPI title="Pending" value={stats.pending} />
              <KPI title="Disposed" value={stats.disposed} />
              <KPI title="Hearings" value={upcomingHearings.length} />
            </div>
          </div>
        )}

        {/* PANELS */}
        <div style={styles.panelGrid}>
          <Panel title="Cases by Stage">
            <Empty text="No workflow data yet" />
          </Panel>

          <Panel title="Status Distribution">
            <div style={styles.donut}>
              <div style={styles.donutInner}>
                {stats.pending} Pending
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ---------- COMPONENTS ---------- */

function KPI({ title, value }) {
  return (
    <div style={styles.kpi}>
      <div style={styles.kpiTitle}>{title}</div>
      <div style={styles.kpiValue}>{value}</div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div style={styles.panel}>
      <div style={styles.panelTitle}>{title}</div>
      {children}
    </div>
  );
}

function Empty({ text }) {
  return <div style={styles.empty}>{text}</div>;
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

/* ---------- STYLES ---------- */

const styles = {
  wrapper: {
    background: "#f8fafc",
    minHeight: "100vh",
    padding: 24,
  },

  container: {
    maxWidth: 1100,
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

  actions: {
    display: "flex",
    gap: 10,
  },

  primaryBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    background: "#1d4ed8",
    color: "white",
    border: "none",
    fontWeight: 700,
    cursor: "pointer",
  },

  secondaryBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    cursor: "pointer",
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },

  kpi: {
    background: "#fff",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  },

  kpiTitle: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
  },

  kpiValue: {
    fontSize: 22,
    fontWeight: 900,
    marginTop: 6,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },

  card: {
    background: "white",
    border: "1px solid #e6e8ef",
    borderRadius: 14,
    padding: 16,
    display: "flex",
    gap: 12,
    alignItems: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",   // ✅
  },

  cardHover: {
    transform: "translateY(-2px)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  },

  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "#f1f5f9",
    display: "grid",
    placeItems: "center",
  },

  cardTitle: {
    fontWeight: 700,
  },

  cardDesc: {
    fontSize: 13,
    color: "#64748b",
  },

  panelGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 12,
  },

  panel: {
    background: "white",
    border: "1px solid #e6e8ef",
    borderRadius: 14,
    padding: 16,
  },

  panelTitle: {
    fontWeight: 700,
    marginBottom: 10,
  },

  empty: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 13,
    color: "#64748b",
  },

  donut: {
    width: 150,
    height: 150,
    borderRadius: "50%",
    border: "18px solid #e5e7eb",
    borderTop: "18px solid #1d4ed8",
    margin: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  donutInner: {
    fontSize: 13,
    fontWeight: 600,
    color: "#64748b",
  },

  section: {
    background: "white",
    border: "1px solid #e6e8ef",
    borderRadius: 14,
    padding: 16,
  },

  list: {
    display: "grid",
    gap: 8,
  },

  caseRow: {
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  hearingRow: {
    display: "grid",
    gridTemplateColumns: "120px 1fr 1fr",
    gap: 10,
    padding: 10,
    borderBottom: "1px solid #f1f5f9",
  },

  meta: {
    fontSize: 12,
    color: "#6b7280",
  },

  counselBox: {
    marginTop: 16,
    background: "#fff",
    padding: 16,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
  },

  counselTitle: {
    fontWeight: 700,
    marginBottom: 12,
  },

  stageBox: {
    marginTop: 12,
  },

  stageTitle: {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 8,
  },

  stageRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    padding: "4px 0",
  },

  select: {
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
  },

  stat: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 10,
    textAlign: "center",
  },

  statLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 600,
  },

  statValue: {
    fontSize: 18,
    fontWeight: 800,
    marginTop: 4,
  },

  topbar: {
    height: 60,
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    padding: "0 24px",
    display: "flex",              // ✅ FIX
    justifyContent: "space-between",
    alignItems: "center",
  },

  alertRow: {
    padding: 10,
    borderBottom: "1px solid #f1f5f9",
  },

  actionRow: {
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    marginBottom: 8,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  controlBar: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
  },

  mainGrid: {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
  },

  actionCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    cursor: "pointer",
    background: "#fff",
  },

  actionTop: {
    display: "flex",
    justifyContent: "space-between",
    fontWeight: 700,
  },

  priorityBadge: (priority) => ({
    fontSize: 11,
    padding: "2px 6px",
    borderRadius: 6,
    color: "white",
    background:
      priority === "HIGH"
        ? "#dc2626"
        : priority === "MEDIUM"
        ? "#f59e0b"
        : "#16a34a",
  }),

  nextAction: {
    marginTop: 6,
    fontSize: 13,
    color: "#1e293b",
  },

  alertCard: {
    padding: 10,
    borderRadius: 8,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    marginBottom: 8,
  },

  priorityCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    background: "#fff",
  },
};