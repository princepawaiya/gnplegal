import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import StickyTasks from "./StickyTasks";

export default function CounselSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const menu = [
    { label: "Dashboard", path: "/gnp/dashboard", icon: "🏠" },
    { label: "Cases", path: "/gnp/cases", icon: "📂" },
    { label: "Hearings", path: "/gnp/hearings", icon: "📅" },
    { label: "Documents", path: "/gnp/documents", icon: "📄" },
    { label: "Performance", path: "/gnp/performance", icon: "📊" },
    { label: "Knowledge Hub", path: "/gnp/knowledge", icon: "📚" },
    { label: "Settings", path: "/gnp/settings", icon: "⚙️" },
  ];

  return (
    <div style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logo}>GNP Counsel</div>

      {/* Menu */}
      <div style={styles.menu}>
        {menu.map((item) => {
          const active = location.pathname.startsWith(item.path);

          return (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                ...styles.menuItem,
                ...(active ? styles.activeItem : {}),
              }}
            >
              <span style={styles.icon}>{item.icon}</span>
              {item.label}
            </div>
          );
        })}
      </div>

      {/* Bottom Section */}
      <div style={styles.bottom}>
        
        {/* ✅ Sticky Notes */}
        <div style={styles.stickyContainer}>
          <StickyTasks compact />
        </div>

        {/* Help Box */}
        <div style={styles.helpBox}>
          <div style={{ fontWeight: 600 }}>Need Help?</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Contact support - prince@gnplegal.com
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  sidebar: {
    background: "var(--card)",
    color: "var(--text)",
    display: "flex",
    flexDirection: "column",
    padding: "20px 16px",
    height: "100vh",
  },
  logo: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 30,
  },
  menu: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  menuItem: {
    padding: "10px 12px",
    borderRadius: 8,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    transition: "0.2s",
  },
  activeItem: {
    background: "rgba(0,0,0,0.05)",
  },
  icon: {
    fontSize: 16,
  },
  bottom: {
    marginTop: "auto",
  },
  helpBox: {
    background: "rgba(0,0,0,0.04)",
    padding: 12,
    borderRadius: 10,
    fontSize: 13,
  },

  stickyContainer: {
    marginTop: 16,
    background: "#fff9c4",
    borderRadius: 12,
    padding: 10,
    border: "1px solid #facc15",
  },
};