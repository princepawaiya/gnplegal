import { theme } from "./index";

export const components = {
  card: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: 16,
    boxShadow: theme.shadow.sm,
  },

  primaryBtn: {
    padding: "10px 16px",
    borderRadius: theme.radius.sm,
    background: theme.colors.primary,
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },

  secondaryBtn: {
    padding: "10px 16px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    background: "#fff",
    cursor: "pointer",
  },

  input: {
    padding: "10px 12px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
  },
};