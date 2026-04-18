/* =====================================================
   API CONFIG
===================================================== */
const COUNSEL_BASE = "/local-counsels";
const API_BASE = import.meta.env.VITE_API_URL;

if (!API_BASE) {
  console.warn("VITE_API_URL not set");
}

function getToken() {
  return localStorage.getItem("token");
}

function sanitizePayload(value) {
  if (value === "") return null;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayload(item));
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    const cleaned = {};

    Object.keys(value).forEach((key) => {
      cleaned[key] = sanitizePayload(value[key]);
    });

    return cleaned;
  }

  return value;
}

async function upload(path, formData) {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Upload failed");
  }

  return res.json();
}

async function request(path, { method = "GET", body = null } = {}) {
  const headers = {
    Accept: "application/json",
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options = { method, headers };

  // ✅ ONLY attach body for non-GET requests
  if (body !== null && method !== "GET") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(sanitizePayload(body));
  }

  const url = `${API_BASE}${path}`;
  console.log("API CALL:", url);

  const res = await fetch(url, options);

  let data = null;
  const text = await res.text();

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (import.meta.env.DEV) {
    console.log("API RESPONSE:", path, data);
  }

  if (!res.ok) {
    const msg =
      (typeof data === "string" && data) ||
      data?.detail ||
      JSON.stringify(data) ||
      `Request failed (${res.status})`;

    if (import.meta.env.DEV) {
      console.error("API ERROR:", path, msg);
    }

    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.replace("/login");
      return;
    }

    throw new Error(msg);
  }

  
  // 🔥 SAFE STANDARDIZED RESPONSE
  if (data && typeof data === "object") {
  if (Array.isArray(data)) return data;

  // preserve pagination
  if ("data" in data && "total" in data) return data;

  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;

  return data;
}

return data;

}

export async function updateUserPermissions(userId, permissions) {
  const token = localStorage.getItem("token");

  const res = await fetch(
    `${API_BASE}/auth/users/${userId}/permissions`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ permissions }),
    }
  );

  if (!res.ok) throw new Error("Permission update failed");

  return res.json();
}

export async function changeUserPassword(userId, newPassword) {
  return request(`/auth/users/${userId}/change-password`, {
    method: "PUT",
    body: {
      new_password: newPassword,
    },
  });
}

export function listAllPermissions() {
  return request("/roles/permissions");
}

/* =====================================================
   CLIENTS
===================================================== */

export async function listClients() {
  return request("/clients/list");
}

export function createClient(name, spocs) {
  return request("/clients/create", {
    method: "POST",
    body: { name, spocs },
  });
}

export async function updateClient(id, payload, name) {
  return request(`/clients/${id}/update`, {
    method: "PUT",
    body: {
      name,
      ...payload,
    },
  });
}

/* =====================================================
   MATTERS
===================================================== */

export function listMatters(filters = {}) {
  const params = buildQuery(filters);
  return request(`/matters/list${params ? `?${params}` : ""}`);
}

export function createMatter(payload) {
  return request("/matters/create", {
    method: "POST",
    body: payload,
  });
}

export function getMatterById(id) {
  if (!id || isNaN(Number(id))) {
    return null; // 🔥 prevent API call
  }

  return request(`/matters/${id}`);
}
export const getMatter = getMatterById;

export function updateMatter(id, payload) {
  return request(`/matters/${id}/update`, {
    method: "PUT",
    body: payload,
  });
}

export function deleteMatter(id) {
  return request(`/matters/${id}/delete`, {
    method: "DELETE",
  });
}

export function assignCounsel(matterId, counselId) {
  return request(`/matters/${matterId}/assign`, {
    method: "POST",
    body: { counsel_id: counselId },
  });
}

export function getUpcomingHearings(params = {}) {
  const query = new URLSearchParams();

  if (params.days !== undefined) query.append("days", Number(params.days));
  if (params.client_id !== undefined && params.client_id !== "" && params.client_id !== null)
    query.append("client_id", Number(params.client_id));

  const qs = query.toString();

  return request(
    `/matters/upcoming-hearings${qs ? `?${qs}` : ""}`
  );
}

export function getMatterTimeline(matterId) {
  return request(`/matters/${matterId}/timeline`);
}

/* Export Matters Excel */
export async function exportMattersExcel() {
  const token = getToken();

  const res = await fetch(`${API_BASE}/matters/export/excel`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Export failed");

  return await res.blob();
}

/* =====================================================
   LOCAL COUNSELS
===================================================== */

export function listLocalCounsels(filtersOrState = {}, maybeCity) {
  let state = "";
  let city = "";

  if (typeof filtersOrState === "object" && filtersOrState !== null) {
    state = filtersOrState.state || "";
    city = filtersOrState.city || "";
  } else {
    state = filtersOrState || "";
    city = maybeCity || "";
  }

  const params = new URLSearchParams({
    ...(state && { state }),
    ...(city && { city }),
  }).toString();

  return request(`${COUNSEL_BASE}/list${params ? `?${params}` : ""}`);
}

export function getCounselById(id) {
  return request(`/local-counsels/${id}`);
}

export function updateLocalCounsel(id, payload) {
  return request(`/local-counsels/${id}/update`, {
    method: "PUT",
    body: payload,
  });
}

export function approveLocalCounsel(id) {
  return request(`/local-counsels/${id}/approve`, {
    method: "PUT",
  });
}

export function createLocalCounsel(payload) {
  return request("/local-counsels/create", {
    method: "POST",
    body: payload,
  });
}

export function listLocalCounselsByCity(city) {
  return request(
    `/local-counsels/by-city?city=${encodeURIComponent(city)}`
  );
}

/* =====================================================
   PRODUCTS
===================================================== */

export function listProducts() {
  return request("/products/list");
}

export function createProduct(name) {
  return request(`/products/create?name=${encodeURIComponent(name)}`, {
    method: "POST",
  });
}

/* =====================================================
   FORUMS
===================================================== */

export function listStates() {
  return request("/forums/state/list");
}

export function listForumTypes() {
  return request("/forums/forum-type/list");
}

export function listDistricts(state_id) {
  return request(`/forums/district/list?state_id=${state_id}`);
}

export function createState(name) {
  return request(`/forums/state/create?name=${encodeURIComponent(name)}`, {
    method: "POST",
  });
}

export function createDistrict(name, state_id) {
  return request(
    `/forums/district/create?name=${encodeURIComponent(name)}&state_id=${state_id}`,
    { method: "POST" }
  );
}

export function createForum(payload) {
  const params = new URLSearchParams();

  params.append("name", payload.name);
  params.append("forum_type_id", payload.forum_type_id);

  if (payload.state_id !== "" && payload.state_id !== null && payload.state_id !== undefined) {
    params.append("state_id", payload.state_id);
  }

  if (payload.district_id !== "" && payload.district_id !== null && payload.district_id !== undefined) {
    params.append("district_id", payload.district_id);
  }

  return request(`/forums/create?${params.toString()}`, {
    method: "POST",
  });
}

export function listForums(filters = {}) {
  const paramsObj = {};

  if (filters.forum_type_id)
    paramsObj.forum_type_id = filters.forum_type_id;

  if (filters.state_id !== undefined && filters.state_id !== "")
    paramsObj.state_id = filters.state_id;

  if (filters.district_id !== undefined && filters.district_id !== "")
    paramsObj.district_id = filters.district_id;

  const params = new URLSearchParams(paramsObj).toString();

  return request(`/forums/list${params ? `?${params}` : ""}`);
}

export function suggestJurisdiction(payload) {
  return request("/forums/jurisdiction/suggest", {
    method: "POST",
    body: payload,
  });
}

/* =====================================================
   INVOICES
===================================================== */

export function generateInvoice(payload) {
  return request("/invoices/generate", {
    method: "POST",
    body: payload,
  });
}

export function listInvoices(filters = {}) {
  const params = buildQuery(filters);
  return request(`/invoices/list${params ? `?${params}` : ""}`);
}

export function getInvoiceAging() {
  return request("/invoices/aging");
}

/* Download Invoice PDF */
export async function downloadInvoicePdf(invoiceId) {
  const token = getToken();

  const res = await fetch(`${API_BASE}/invoices/${invoiceId}/pdf`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to download PDF");
  }

  return await res.blob();
}

/* =====================================================
   ACCOUNTS DASHBOARD
===================================================== */

export function getAccountsDashboard(filters = {}) {
  const params = buildQuery(filters);
  return request(`/accounts/dashboard${params ? `?${params}` : ""}`);
}

/* =====================================================
   MIS REPORTS
===================================================== */

export function getStatusSummary() {
  return request("/mis/status-summary");
}

export function getClaimSummary() {
  return request("/mis/claim-summary");
}

export function getStateSummary() {
  return request("/mis/state-summary");
}

export function getForumTypeSummary() {
  return request("/mis/forum-type-summary");
}

export function getClientSummary() {
  return request("/mis/client-summary");
}

export function deleteProduct(id) {
  return request(`/products/${id}/delete`, {
    method: "DELETE",
  });
}

/* =====================================================
   CLIENT INVOICE
===================================================== */

export function saveClientInvoice(matterId, payload) {
  return request(`/matters/${matterId}/client-invoice`, {
    method: "POST",
    body: payload,
  });
}

export async function uploadClientInvoiceFile(matterId, type, file) {
  const token = getToken();

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${API_BASE}/matters/${matterId}/client-invoice/upload?type=${type}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Upload failed");
  }

  return await res.json();
}

export function deleteClientInvoiceFile(matterId, type) {
  return request(
    `/matters/${matterId}/client-invoice/delete?type=${type}`,
    { method: "DELETE" }
  );
}

export async function uploadClientPayment(matterId, type, formData) {
  const token = getToken();

  const res = await fetch(
    `${API_BASE}/matters/${matterId}/client-payment/upload?type=${type}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Upload failed");
  }

  return await res.json();
}

/* =====================================================
   MIS DASHBOARD
===================================================== */

export function getMISDashboard(filters = {}) {
  const clean = {};

  Object.keys(filters).forEach((k) => {
    const v = filters[k];
    if (v !== "" && v !== null && v !== undefined) {
      clean[k] = v;
    }
  });

  const params = new URLSearchParams(clean).toString();

  return request(`/mis-dashboard/dashboard${params ? `?${params}` : ""}`);
}


export function generateConsolidatedInvoice(payload) {
  return request("/invoices/generate-consolidated", {
    method: "POST",
    body: {
      ...payload,
      matter_ids: Array.isArray(payload.matter_ids)
        ? payload.matter_ids
        : [payload.matter_ids], // 🔥 FIX
    },
  });
}

export function previewInvoice(invoiceId) {
  return request(`/invoices/${invoiceId}/preview`);
}

export function finalizeInvoice(invoiceId) {
  return request(`/invoices/${invoiceId}/finalize`, {
    method: "POST"
  });
}

export async function downloadConsolidatedDocx(invoiceId) {
  console.log("DOWNLOAD DOCX ID:", invoiceId, typeof invoiceId);

  const token = getToken();

  const res = await fetch(`${API_BASE}/invoices/${invoiceId}/download-docx`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("DOWNLOAD ERROR:", text);
    throw new Error(text || "Download failed");
  }

  return await res.blob();
}

export async function getLawyerPerformance(lawyerId) {
  const res = await fetch(
    `${API_BASE}/performance/lawyer/${lawyerId}`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    }
  );

  const data = await res.json();

  if (!res.ok) throw new Error(data.detail || "Failed to fetch performance");

  return data;
}

export function listRoles() {
  return request("/roles/list"); // already normalized
}

export async function assignRole(userId, roleId) {
  return request("/roles/assign", {
    method: "PUT",
    body: {
      user_id: userId,
      role_id: roleId,
    },
  });
}

export async function listPermissions() {
  const data = await request("/roles/permissions");

  // 🔥 FORCE GROUP STRUCTURE SAFETY
  if (!Array.isArray(data)) return [];

  // already grouped
  if (data.length && data[0]?.items) return data;

  // fallback: flat → group into "General"
  return [
    {
      group: "General",
      items: data.map((p) =>
        typeof p === "string"
          ? { code: p, label: p.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase()) }
          : p
      ),
    },
  ];
}

export function deleteClient(id) {
  return request(`/clients/${id}/delete`, {
    method: "DELETE",
  });
}

export function updateLDOH(matterId, ldoh) {
  return request(`/matters/${matterId}/update-ldoh`, {
    method: "PUT",
    body: { ldoh },
  });
}

export function updateStage(matterId, stage) {
  return request(`/matters/${matterId}/update-stage`, {
    method: "PUT",
    body: { stage },
  });
}

export function updateMatterStatus(matterId, status) {
  return request(`/matters/${matterId}/update-status`, {
    method: "PUT",
    body: { status },
  });
}

export function getHearingHistory(matterId) {
  return request(`/hearings/history/${matterId}`);
}

export function updateNDOH(matterId, payload) {
  return request(`/hearings/update-ndoh/${matterId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function editLastNDOH(matterId, payload) {
  return request(`/hearings/edit-last-ndoh/${matterId}`, {
    method: "PUT",
    body: payload,
  });
}

export function listMatterDocuments(matterId) {
  if (!matterId || isNaN(Number(matterId))) return [];
  return request(`/matters/${matterId}/documents`);
}

export async function uploadMatterDocuments(matterId, files) {
  const token = localStorage.getItem("token");
  const results = [];

  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/matters/${matterId}/documents`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Upload failed");
    }

    results.push(await res.json());
  }

  return results;
}

export async function uploadMatterDocument(matterId, file) {
  const token = localStorage.getItem("token");

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/matters/${matterId}/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Upload failed");
  }

  return await res.json();
}

/* =====================================================
   MIS FILTERS
===================================================== */

export function getMISClients() {
  return request("/mis-dashboard/clients");
}

export function getMISProducts() {
  return request("/mis-dashboard/products");
}

export function getMISForums() {
  return request("/mis-dashboard/forums");
}

export function getMISStates() {
  return request("/mis-dashboard/states");
}

export function getMISDistricts(state_id) {
  const params = state_id ? `?state_id=${state_id}` : "";
  return request(`/mis-dashboard/districts${params}`);
}

export function getMISCounsels() {
  return request("/mis-dashboard/counsels");
}

/* =====================================================
   MIS EXPORTS
===================================================== */

export async function exportMISExcel(filters = {}) {
  const clean = {};

  Object.keys(filters || {}).forEach((key) => {
    const value = filters[key];
    if (value !== "" && value !== null && value !== undefined) {
      clean[key] = value;
    }
  });

  const query = new URLSearchParams(clean).toString();

  const res = await fetch(
    `${API_BASE}/mis-dashboard/export/excel${query ? `?${query}` : ""}`,
    {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "MIS Excel export failed");
  }

  return await res.blob();
}

export async function exportCauseListExcel(filters = {}) {
  const token = getToken();
  const params = buildQuery(filters);

  const res = await fetch(
    `${API_BASE}/cause-list/export/excel${params ? `?${params}` : ""}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  // 🔥 IMPORTANT CHECK
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Export failed");
  }

  const contentType = res.headers.get("content-type");

  // ❌ If backend sends JSON instead of file
  if (contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error("Server returned JSON instead of file: " + text);
  }

  return await res.blob();
}

export async function sendCauseEmail(id) {
  return fetch(`${API_BASE}/cause-list/${id}/send-email`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token"),
    },
  });
}

export async function sendCauseSMS(id) {
  return fetch(`${API_BASE}/cause-list/${id}/send-sms`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token"),
    },
  });
}

const NOTIFICATION_SETUP_KEY = "cause_notification_setup";

export function getNotificationSetup() {
  try {
    const raw = localStorage.getItem(NOTIFICATION_SETUP_KEY);

    if (!raw) {
      return {
        emailConnected: false,
        smsConnected: false,
        whatsappConnected: false,
        senderEmail: "",
        senderPhone: "",
        wifiName: "",
      };
    }

    const parsed = JSON.parse(raw);

    return {
      emailConnected: !!parsed.emailConnected,
      smsConnected: !!parsed.smsConnected,
      whatsappConnected: !!parsed.whatsappConnected,
      senderEmail: parsed.senderEmail || "",
      senderPhone: parsed.senderPhone || "",
      wifiName: parsed.wifiName || "",
    };
  } catch {
    return {
      emailConnected: false,
      smsConnected: false,
      whatsappConnected: false,
      senderEmail: "",
      senderPhone: "",
      wifiName: "",
    };
  }
}

export function saveNotificationSetup(payload) {
  const current = getNotificationSetup();

  const merged = {
    ...current,
    ...payload,
  };

  localStorage.setItem(NOTIFICATION_SETUP_KEY, JSON.stringify(merged));
  return merged;
}

export function buildWhatsAppUrl(phone, message) {
  const cleanedPhone = String(phone || "").replace(/\D/g, "");
  const encodedMessage = encodeURIComponent(message || "");

  if (!cleanedPhone) return "";

  return `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;
}

export function getClientMatters(clientId) {
  return request(`/invoices/client-matters/${clientId}`);
}

export function getInvoiceTracker(clientId) {
  const query = clientId ? `?client_id=${clientId}` : "";
  return request(`/invoices/tracker${query}`);
}

export function createMiscInvoice(payload) {
  return request("/invoices/misc", {
    method: "POST",
    body: payload,
  });
}

export function deleteInvoice(id) {
  return request(`/invoices/${id}`, {
    method: "DELETE",
  });
}

export async function updateInvoiceTotal(id, final_total, selected_spoc_id) {
  return request(`/invoices/${id}/update-total`, {
    method: "PUT",
    body: {
      final_total,
      selected_spoc_id,
    },
  });
}

export function getClientSpocs(clientId) {
  return request(`/clients/${clientId}/spocs`);
}

export function assignGNPCounsel(matterId, counselId) {
  return request(`/matters/${matterId}/assign-gnp`, {
    method: "POST",
    body: {
      counsel_id: counselId,
    },
  });
}

export async function getGNPCounselSummary() {
  const res = await fetch(`${API_BASE}/gnp-admin/counsel-summary`, {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token"),
    },
  });

  return res.json();
}

export function listUsers() {
  return request("/auth/users");
}

export function buildQuery(params = {}) {
  const clean = {};

  Object.keys(params).forEach((k) => {
    const v = params[k];
    if (v !== "" && v !== null && v !== undefined) {
      clean[k] = v;
    }
  });

  return new URLSearchParams(clean).toString();
}

export async function listGnpCounsels() {
  const users = await request("/auth/users");

  const normalized = Array.isArray(users)
    ? users
    : Array.isArray(users?.data)
    ? users.data
    : Array.isArray(users?.items)
    ? users.items
    : [];

  return normalized.filter((u) => {
    const role = (u.role || "").toLowerCase().trim();
    const roleName = (u.role_name || "").toLowerCase().trim();

    return role === "gnp counsel" || roleName === "gnp counsel";
  });
}

export async function getGNPCounselStats() {
  const data = await request("/gnp-counsel/summary");

  return {
    total: data.total || 0,
    active: data.active || 0,
    disposed: data.disposed || 0,
  };
}

export async function getGNPCounselToday() {
  return request("/gnp-counsel/today");
}

export async function getGNPCounselActivity() {
  return request("/gnp-counsel/activity");
}

export function getAdminDashboard() {
  return request("/gnp-admin/dashboard");
}

export async function getAdminOverview() {
  const res = await fetch(`${API_BASE}/dashboard/admin-overview`, {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token"),
    },
  });

  if (!res.ok) throw new Error("Failed to load admin dashboard");

  return res.json();
}

export async function getControlTower() {
  const res = await fetch(`${API_BASE}/dashboard/control-tower`, {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token"),
    },
  });

  if (!res.ok) throw new Error("Failed to load control tower");

  return res.json();
}

export async function recordPayment(invoiceId, payload) {
  const token = localStorage.getItem("token");

  const formData = new FormData();
  formData.append("amount", payload.amount);
  formData.append("payment_mode", payload.payment_mode || "");
  formData.append("reference_no", payload.reference_no || "");
  formData.append("remarks", payload.remarks || "");

  if (payload.file) {
    formData.append("file", payload.file);
  }

  const res = await fetch(`${API_BASE}/invoices/${invoiceId}/payment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Payment failed");
  }

  return res.json();
}

export async function updatePayment(id, formData) {
  const res = await fetch(`${API_BASE}/invoices/payments/${id}`, {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token"),
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Update failed");
  }

  return res.json();
}

export async function deletePayment(id) {
  const res = await fetch(`${API_BASE}/invoices/payments/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token"),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Delete failed");
  }

  return res.json();
}

export function getPayments(invoiceId) {
  return request(`/invoices/${invoiceId}/payments`);
}

export async function getInvoiceDashboard() {
  const res = await fetch(`${API_BASE}/invoices/dashboard`, {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token"),
    },
  });

  return res.json();
}
