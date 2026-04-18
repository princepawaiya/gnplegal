export function classifyAlert(alert) {
  const type = alert.type;

  // 🔴 HIGH RISK
  if (type === "overdue_hearing") {
    return {
      level: "high",
      label: "High Risk",
      color: "#dc2626",
      priority: 1,
    };
  }

  // 🟠 MEDIUM RISK
  if (type === "no_counsel") {
    return {
      level: "medium",
      label: "Medium Risk",
      color: "#d97706",
      priority: 2,
    };
  }

  // 🟡 LOW RISK
  if (type === "missing_documents") {
    return {
      level: "low",
      label: "Low Risk",
      color: "#2563eb",
      priority: 3,
    };
  }

  // Default
  return {
    level: "low",
    label: "Info",
    color: "#6b7280",
    priority: 4,
  };
}