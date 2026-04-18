const API_BASE = import.meta.env.VITE_API_URL;

function getAuthHeaders() {
  return {
    Authorization: "Bearer " + localStorage.getItem("token"),
  };
}

/* ================= SUMMARY ================= */
export async function getGNPCounselSummary() {
  const res = await fetch(`${API_BASE}/gnp-counsel/counsel-summary`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) throw new Error("Failed to load summary");

  return res.json();
}

/* ================= TODAY PANEL ================= */
export async function getGNPCounselToday() {
  const res = await fetch(`${API_BASE}/gnp-counsel/today`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) throw new Error("Failed to load today data");

  const json = await res.json();
  return json.data || {};
}

/* ================= CASES ================= */
export async function getGNPCounselCases() {
  const res = await fetch(`${API_BASE}/gnp-counsel/cases`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) throw new Error("Failed to load cases");

  const json = await res.json();
  return json.data || [];
}

/* ================= ACTIVITY ================= */
export async function getGNPCounselActivity() {
  const res = await fetch(`${API_BASE}/gnp-counsel/activity`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) throw new Error("Failed to load activity");

  const json = await res.json();
  return json.data || [];
}

export async function getExecutionPanel() {
  const res = await fetch(`${API_BASE}/gnp-counsel/execution-panel`, {
    headers: getAuthHeaders()
  });

  if (!res.ok) throw new Error("Failed to load execution panel");

  const json = await res.json();
  return json.data || {};
}

export async function getPerformanceScore() {
  const res = await fetch(`${API_BASE}/gnp-counsel/performance-score`, {
    headers: getAuthHeaders()
  });

  if (!res.ok) throw new Error("Failed to load performance score");

  const json = await res.json();
  return json.score || 0;
}

export async function getPriorityCases() {
  const res = await fetch(`${API_BASE}/gnp-counsel/priority-cases`, {
    headers: getAuthHeaders()
  });

  if (!res.ok) throw new Error("Failed to load priority cases");

  const json = await res.json();
  return json.data || [];
}

export async function getAlerts() {
  const res = await fetch(`${API_BASE}/gnp-counsel/alerts`, {
    headers: getAuthHeaders()
  });

  if (!res.ok) throw new Error("Failed to load alerts");

  const json = await res.json();
  return json.data || [];
}