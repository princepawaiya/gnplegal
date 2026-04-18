// ✅ KEEP EXISTING OBJECTS

export const colors = {
  primary: "#111827",
  secondary: "#6b7280",
  background: "#f8fafc",
  white: "#ffffff",
  border: "#e5e7eb",
  danger: "#dc2626",
  success: "#16a34a",
};

export const typography = {
  heading: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111827",
  },
  subheading: {
    fontSize: 16,
    fontWeight: 600,
    color: "#374151",
  },
  valueStrong: {
    fontSize: 16,
    fontWeight: 700,
    color: "#111827",
  },
  highlightLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#6b7280",
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 32,
};

export const elevation = {
  level1: "0 1px 3px rgba(0,0,0,0.08)",
  level2: "0 4px 12px rgba(0,0,0,0.1)",
  level3: "0 8px 20px rgba(0,0,0,0.12)",
};

export const components = {
  primaryBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "none",
    background: "#111827",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "white",
    fontWeight: 600,
    cursor: "pointer",
  },
};



// ✅ ADD THIS (IMPORTANT — FIXES ERROR)

export const theme = {
  colors,
  typography,
  spacing,
  elevation,
  components,
};