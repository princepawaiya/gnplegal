import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Users, FileText, BarChart3, Receipt, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { hasPermission } from "../utils/permissions";

export default function Layout() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [alertCount, setAlertCount] = useState(0);

  const role = user?.role || "client";

  function hasAccess(permission) {
    if (!permission) return true;
    return hasPermission(permission);
  }

  async function fetchUser() {
    try {
      const token = localStorage.getItem("token");
      const API_BASE = import.meta.env.VITE_API_URL;
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        localStorage.clear();
        navigate("/login");
        return;
      }

      const data = await res.json();

      setUser(data);
    } catch (e) {
      console.error("User fetch failed", e);
      localStorage.clear();
      navigate("/login");
    }
  }

  async function loadAlertCount() {
  try {
    const token = localStorage.getItem("token");

    const API_BASE = import.meta.env.VITE_API_URL;

    const res = await fetch(`${API_BASE}/alerts/matters`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return;

    const data = await res.json();

    const count =
      typeof data === "number"
        ? data
        : data?.count ??
          data?.data?.count ??
          data?.total ??
          0;

    setAlertCount(count);
  } catch (e) {
    console.error("Alert count failed", e);
    setAlertCount(0);
  }
}

  useEffect(() => {
    fetchUser();
    loadAlertCount();

    const interval = setInterval(() => {
      loadAlertCount();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // 🔥 Prevent render before user loads
  if (!user) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  const basePath =
    role === "admin"
      ? "/admin"
      : role === "lawyer"
      ? "/lawyer"
      : "/client";

  const navItems = [
  ...(hasAccess("dashboard:view")
    ? [{ to: `${basePath}`, label: "Dashboard", icon: Home }]
    : []),

  ...(hasAccess("users:manage")
    ? [{ to: `${basePath}/users`, label: "Users", icon: Users }]
    : []),

  ...(hasAccess("clients:view")
    ? [{ to: `${basePath}/clients`, label: "Clients", icon: Users }]
    : []),

  ...(hasAccess("matters:view")
    ? [{ to: `${basePath}/matters`, label: "Matters", icon: FileText }]
    : []),

  ...(hasAccess("cause-list:view")
    ? [{ to: `${basePath}/cause-list`, label: "Cause List", icon: FileText }]
    : []),

  ...(hasAccess("mis:view")
    ? [{ to: `${basePath}/mis`, label: "MIS", icon: BarChart3 }]
    : []),

  ...(hasAccess("invoices:view")
    ? [
        { to: `${basePath}/invoices`, label: "Invoices", icon: Receipt },
        { to: `${basePath}/invoices/tracker`, label: "Invoice Tracker", icon: Receipt },
      ]
    : []),

  ...(hasAccess("alerts:view")
    ? [{ to: `${basePath}/alerts`, label: "Alerts", icon: BarChart3 }]
    : []),

  ...(hasAccess("users:manage")
    ? [{ to: `${basePath}/roles`, label: "Roles", icon: Users }]
    : []),
];

  function logout() {
    localStorage.clear();
    navigate("/login");
  }

  return (
    <div style={styles.shell}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.brandIcon}>⚖️</div>
          <div>
            <div style={styles.brandTitle}>LCMS</div>
            <div style={styles.brandSub}>Consumer Litigation</div>
          </div>
        </div>

        <nav style={styles.nav}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  ...styles.navItem,
                  ...(isActive ? styles.navItemActive : {}),
                })}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.classList.contains("active")) {
                    e.currentTarget.style.background = "#1e293b";
                    e.currentTarget.style.color = "#ffffff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.classList.contains("active")) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#cbd5f5";
                  }
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div style={styles.sidebarFooter}>
          <button style={styles.logoutBtn} onClick={logout}>
            <LogOut size={14} />
            Logout
          </button>
          <div style={styles.footerHint}>v0.2 • Local</div>
        </div>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        {/* Header */}
        <header style={styles.topbar}>
          <div style={styles.searchBox}>🔍 Search...</div>

          <div style={styles.topbarRight}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {user?.full_name}
            </div>
            <div style={styles.pill}>Bearer Auth</div>
            <div style={styles.pill}>SQLite</div>

            {hasAccess("alerts:view") && (
            <div
              style={styles.alertWrapper}
              onClick={() => {
                if (hasAccess("alerts:view")) {
                  navigate(`${basePath}/alerts`);
                }
              }}
            >
              🔔
              {alertCount > 0 && (
                <span style={styles.alertCount}>{alertCount}</span>
              )}
            </div>
            )}

            <div style={styles.avatar}>
              {user?.full_name?.[0] || "U"}
            </div>
          </div>
        </header>

        {/* Content */}
        <section style={styles.content}>
          <Outlet />
        </section>
      </main>
    </div>
  );
}

const styles = {
  shell: {
    display: "flex",
    height: "100vh",
    width: "100%",          // ✅ ADD THIS
    overflow: "hidden",     // 🔥 CRITICAL FIX
    background: "#f9fafb",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif',
  },

  sidebar: {
    width: 250,
    minWidth: 250,     // ✅ prevents shrink
    maxWidth: 250, 
    background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
    color: "#e2e8f0",
    height: "100vh",
    padding: "18px 12px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    borderRight: "1px solid #1e293b",
  },

  logo: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 30,
    paddingLeft: 10,
    letterSpacing: 0.5,
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 30,
    padding: "8px 10px",
    borderRadius: 10,
  },

  brandIcon: { fontSize: 18 },

  brandTitle: {
    fontWeight: 700,
    fontSize: 14,
    color: "#ffffff",   // ✅ FIX
  },

  brandSub: {
    fontSize: 11,
    color: "#94a3b8",   // ✅ better contrast
  },

  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "11px 14px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 500,
    color: "#94a3b8",
    cursor: "pointer",
    transition: "all 0.18s ease",
  },

  navItemHover: {
    background: "#1e293b",
    color: "#ffffff",
  },

  navItemActive: {
    background: "#1d4ed8",
    color: "#ffffff",
    fontWeight: 600,
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
  },

  bottomSection: {
    borderTop: "1px solid #1e293b",
    paddingTop: 12,
    marginTop: 20,
  },

  sidebarFooter: {
    marginTop: "auto",
    paddingTop: 16,
    borderTop: "1px solid #1e293b",
  },

  logoutBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    padding: "10px",
    borderRadius: 10,
    border: "1px solid #1e293b",
    background: "#020617",
    color: "#cbd5f5",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  footerHint: {
    marginTop: 8,
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
  },

  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",     // ✅ vertical scroll
    overflowX: "hidden",   // 🔥 prevents horizontal scroll
  },

  topbar: {
    height: 60,
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    padding: "0 24px",

    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",   // 🔥 KEY FIX
  },

  searchBox: {
    fontSize: 13,
    color: "#9ca3af",
    background: "#f3f4f6",
    padding: "6px 12px",
    borderRadius: 8,
  },

  topbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  pill: {
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 999,
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
  },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#111827",
    color: "white",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
  },

  content: {
    flex: 1,
    padding: "24px",
    overflowY: "auto",
    overflowX: "hidden",     // 🔥 CRITICAL
    maxWidth: 1200,          // 🔥 LIMIT WIDTH
    width: "100%",
    margin: "0 auto",        // 🔥 center content
  },

  alertWrapper: {
    position: "relative",
    fontSize: 18,
    cursor: "pointer",
  },

  alertCount: {
    position: "absolute",
    top: -6,
    right: -10,
    background: "#dc2626",
    color: "white",
    borderRadius: "50%",
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 6px",
    minWidth: 18,
    textAlign: "center",
  },
};