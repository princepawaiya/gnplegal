import { colors, typography, spacing, elevation } from "./index";

/* ================= INPUT ================= */

export const inputStyles = {
  base: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${colors.border}`,
    fontSize: 14,
    outline: "none",
    transition: "all 0.2s ease",
    background: "#fff",
  },

  focus: {
    border: "1px solid #1d4ed8",
    boxShadow: "0 0 0 2px rgba(29,78,216,0.1)",
  },
};

/* ================= BUTTON ================= */

export const buttonStyles = {
  primary: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "none",
    background: colors.primary,
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  secondary: {
    padding: "10px 16px",
    borderRadius: 10,
    border: `1px solid ${colors.border}`,
    background: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  success: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "none",
    background: colors.success,
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
};

/* ================= CARD ================= */

export const cardStyles = {
  base: {
    background: "#fff",
    border: `1px solid ${colors.border}`,
    borderRadius: 14,
    padding: 18,
    boxShadow: elevation.level1,
    transition: "all 0.2s ease",
  },

  hover: {
    transform: "translateY(-2px)",
    boxShadow: elevation.level2,
  },
};

/* ================= SECTION ================= */

export const sectionStyles = {
  wrapper: {
    background: "#fff",
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },

  header: {
    padding: "16px 20px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    ...typography.subheading,
    fontWeight: 700,
  },

  body: {
    padding: "20px",
  },
};

/* ================= LABEL ================= */

export const labelStyles = {
  base: {
    fontSize: 12,
    fontWeight: 600,
    color: "#64748b",
  },
};