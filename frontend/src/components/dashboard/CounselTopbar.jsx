import { useState, useEffect } from "react";
import { getUserFromToken } from "../../utils/permissions";
import CounselProfileMenu from "./CounselProfileMenu";
import CounselThemeToggle from "./CounselThemeToggle";

export default function CounselTopbar() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = getUserFromToken();
    setUser(u);
  }, []);

  return (
    <div style={styles.topbar}>
      
      {/* LEFT */}
      <div style={styles.left}>
        <div style={styles.title}>GNP Counsel Dashboard</div>
        <div style={styles.subtitle}>
          Manage your cases, hearings & performance
        </div>
      </div>

      {/* RIGHT */}
      <div style={styles.right}>

        {/* Theme Toggle */}
        <CounselThemeToggle />

        {/* Divider */}
        <div style={styles.divider} />

        {/* User */}
        <div style={styles.user}>
          <div style={styles.userText}>
            <div style={styles.name}>
              {user?.full_name || "User"}
            </div>
            <div style={styles.role}>
              Counsel
            </div>
          </div>

          {/* Profile Menu */}
          <CounselProfileMenu user={user} />
        </div>

      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const styles = {
  topbar: {
    height: 72,
    background: "var(--card)",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
  },

  left: {
    display: "flex",
    flexDirection: "column",
  },

  title: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--text)",
  },

  subtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },

  right: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  divider: {
    width: 1,
    height: 24,
    background: "#e5e7eb",
  },

  user: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  userText: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  },

  name: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
  },

  role: {
    fontSize: 11,
    color: "#94a3b8",
  },
};