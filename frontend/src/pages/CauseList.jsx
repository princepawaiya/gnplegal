import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listClients } from "../services/api";
import {
  sendCauseEmail,
  sendCauseSMS,
  getNotificationSetup,
  saveNotificationSetup,
  buildWhatsAppUrl,
} from "../services/api";

const API_BASE = "http://127.0.0.1:8000";

export default function CauseList() {
  const [files, setFiles] = useState([]);
  const [data, setData] = useState({});
  const [view, setView] = useState("weekly");
  const [allClients, setAllClients] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [client, setClient] = useState("");
  const [loading, setLoading] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState({});
  const [printMode, setPrintMode] = useState(false);
  const [counsels, setCounsels] = useState([]);
  const navigate = useNavigate();
  const user = JSON.parse(atob(localStorage.getItem("token").split(".")[1]));

  const basePath =
    user.role === "admin"
      ? "/admin"
      : user.role === "lawyer"
      ? "/lawyer"
      : "/client";
  const [selectedWeek, setSelectedWeek] = useState(() => {
  const today = new Date();
  const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return monday.toISOString().slice(0, 10);
  });

  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [sendModal, setSendModal] = useState(null);
  const [notificationSetup, setNotificationSetup] = useState(() =>
    getNotificationSetup()
  );
  const [purposeMap, setPurposeMap] = useState({});
  const [savingMap, setSavingMap] = useState({});

  async function loadCounsels() {
  try {
    const res = await fetch(`${API_BASE}/local-counsels/list`, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    const text = await res.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      console.error("Non-JSON response:", text);
      return;
    }
    setCounsels(Array.isArray(json) ? json : []);
  } catch (err) {
    console.error("Counsels error:", err);
  }
}

async function updateField(id, field, value) {
  try {
    await fetch(`${API_BASE}/cause-list/update-field`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify({ id, field, value }),
    });
  } catch (err) {
    alert("Update failed");
  }
}

async function loadFiles() {
  try {
    const url = `${API_BASE}/cause-list/files`;
    console.log("FILES URL:", url);

    const res = await fetch(url, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    console.log("FILES STATUS:", res.status);

    if (!res.ok) {
      console.error("FILES FAILED:", res.status);
      return;
    }

    const data = await res.json();
    setFiles(Array.isArray(data) ? data : []);

  } catch (err) {
    console.error("Files error:", err);
  }
}

async function loadAllClients() {
  try {
    const res = await listClients();

    // normalize (your API returns array)
    const names = (res || [])
      .map((c) => c.name || c.legal_name)
      .filter(Boolean);

    setAllClients(names);
  } catch (err) {
    console.error("Clients load error:", err);
  }
}

  useEffect(() => {
    loadFiles();
    loadData();
    loadCounsels();
    loadAllClients();
  }, [view, month, year, client, selectedWeek]);

  async function downloadExcel() {
    const params = new URLSearchParams();

    params.append("view", view);

    if (view === "monthly") {
      if (year) params.append("year", year);
      if (month) params.append("month", month);
    }

    if (view === "weekly") {
      if (selectedWeek) params.append("start_date", selectedWeek);
    }

    if (client) {
      params.append("client_name", client);
    }

    const url = `${API_BASE}/cause-list/export/excel?${params.toString()}`;

    const res = await fetch(url, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("EXPORT ERROR:", text);
      alert("Export failed");
      return;
    }

    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = "cause_list.xlsx";
    link.click();
  }

  async function loadData() {
    try {
      setLoading(true);

      let url = `/cause-list/weekly?start_date=${selectedWeek}`;

      if (view === "monthly") {
        url = `/cause-list/monthly?year=${year}&month=${month}`;
      }

      if (client) {
        url += url.includes("?")
          ? `&client_name=${client}`
          : `?client_name=${client}`;
      }

      const res = await fetch(`${API_BASE}${url}`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      console.log("DATA STATUS:", res.status);
      console.log("TOKEN:", localStorage.getItem("token"));

      const text = await res.text();

      let json;
      try {
        json = JSON.parse(text);
      } catch {
        console.error("DATA NON-JSON RESPONSE:", text);
        return;
      }
      
      // ✅ normalize response (array → grouped)
      if (Array.isArray(json)) {
        const grouped = {};
        json.forEach((m) => {
          const date = m.ndoh
            ? new Date(m.ndoh).toISOString().slice(0, 10)
            : "No Date";
          const district = m.district || "Unknown";
          const court = m.forum || "Court 1";

          if (!grouped[date]) grouped[date] = {};
          if (!grouped[date][district]) grouped[date][district] = {};
          if (!grouped[date][district][court]) grouped[date][district][court] = [];

          grouped[date][district][court].push(m);
        });

        setData(grouped);
      } else if (json && typeof json === "object" && !json.detail) {
        setData(json);
      } else {
        console.error("Invalid cause list payload:", json);
        setData({});
      }
    } catch (err) {
      console.error("Data error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/cause-list/upload`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: formData,
    });

    const result = await res.json();

    if (!res.ok) {
      alert(result.detail?.message || "Upload failed");
      return;
    }

    alert("Upload successful");
    loadFiles();
    loadData();
  }

  function toggleDate(date) {
    setCollapsedDates((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  }

  async function handleSendReminder(id, mode) {
    try {
      if (mode === "email") {
        await sendCauseEmail(id);
        alert("Email sent");
      } else {
        await sendCauseSMS(id);
        alert("SMS sent");
      }
    } catch (err) {
      alert("Failed to send " + mode);
    }
  }

  const clients = allClients;

  const printStyles = `
    @media print {
    body {
        background: white;
    }

    button {
        display: none !important;
    }

    @page {
        size: A4;
        margin: 20mm;
    }

    .print-page {
        page-break-after: always;
    }

    .court-title {
        text-align: center;
        font-size: 18px;
        font-weight: 900;
        margin-bottom: 10px;
    }

    .court-subtitle {
        text-align: center;
        font-size: 13px;
        margin-bottom: 20px;
    }

    .case-row {
        font-size: 12px;
        line-height: 1.4;
    }
    };
    `;

    const debounceMap = {};

    function debouncedUpdate(id, field, value) {
      const key = `${id}-${field}`;

      setSavingMap(prev => ({ ...prev, [id]: "saving" }));

      if (debounceMap[key]) {
        clearTimeout(debounceMap[key]);
      }

      debounceMap[key] = setTimeout(async () => {
        try {
          await updateField(id, field, value);
          setSavingMap(prev => ({ ...prev, [id]: "saved" }));
        } catch {
          setSavingMap(prev => ({ ...prev, [id]: "error" }));
        }
      }, 500);
    }

    function handleEmail(id) {
      return sendCauseEmail(id)
        .then(() => {
          alert("Email sent successfully");
        })
        .catch((err) => {
          console.error(err);
          alert("Failed to send email");
          throw err;
        });
    }

    function handleSMS(id) {
      return sendCauseSMS(id)
        .then(() => {
          alert("SMS sent successfully");
        })
        .catch((err) => {
          console.error(err);
          alert("Failed to send SMS");
          throw err;
        });
    }

    function openNotificationSetup() {
      setNotificationSetup(getNotificationSetup());
      setSetupModalOpen(true);
    }

    function handleSetupField(field, value) {
      setNotificationSetup((prev) => ({
        ...prev,
        [field]: value,
      }));
    }

    function saveSetupAndClose() {
      const saved = saveNotificationSetup(notificationSetup);
      setNotificationSetup(saved);
      setSetupModalOpen(false);
      alert("Notification setup saved");
    }

    function openSendModal(matter, channel) {
      let message = "";
      const email = matter.counsel_email || "";

      // 🔥 Dynamic Greeting
      const greeting = (() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Morning";
        if (hour < 17) return "Afternoon";
        return "Evening";
      })();

      const counselName = matter.counsel_name || "Sir/Madam";

      if (channel === "whatsapp") {
        message = [
          `*GNP LEGAL – HEARING ALERT*`,
          ``,
          `Good ${greeting}, *${counselName}*`,
          ``,
          `Trust this finds you well.`,
          ``,
          `*Matter:* ${matter.matter_name || "-"}`,
          `*Case No:* ${matter.case_no || "-"}`,
          `*Client:* ${matter.client_name || "-"}`,
          ``,
          `*Next Date:* ${formatDate(matter.ndoh)}`,
          `*Purpose:* ${matter.purpose || "-"}`,
          ``,
          `Kindly take necessary action and share update after hearing.`,
        ].join("\n");

      } else {
        // 📧 EMAIL MESSAGE (clean, no newline issues)
        message = `
    GNP LEGAL – HEARING ALERT

    Dear ${counselName},

    Good ${greeting}. Trust this finds you well.

    Please find the details of the upcoming matter:

    ----------------------------------------
    Matter Name   : ${matter.matter_name || "-"}
    Case Number   : ${matter.case_no || "-"}
    Client Name   : ${matter.client_name || "-"}
    ----------------------------------------

    Next Date     : ${formatDate(matter.ndoh)}
    Purpose       : ${matter.purpose || "-"}

    You are requested to kindly appear and conduct the matter.
    Please share the hearing update upon conclusion.

    Warm regards,  
    GNP Legal Team
        `.trim();
      }

      setSendModal({
        matter,
        channel,
        message,
        email: email,
      });
    }
    function closeSendModal() {
      setSendModal(null);
    }

    async function confirmSend() {
      if (!sendModal) return;

      const { matter, channel, message } = sendModal;

      try {
        if (channel === "email") {
          await fetch(`${API_BASE}/cause-list/${matter.id}/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + localStorage.getItem("token"),
            },
            body: JSON.stringify({
              email: sendModal.email,   // ✅ send edited email
            }),
          });

          closeSendModal();
          return;
        }

        if (channel === "sms") {
          await handleSMS(matter.id);
          closeSendModal();
          return;
        }

        if (channel === "whatsapp") {
          const phone = matter.counsel_phone || "";
          const url = buildWhatsAppUrl(phone, message);

          if (!url) {
            alert("Counsel phone number not available");
            return;
          }

          window.open(url, "_blank");
          closeSendModal();
        }
      } catch {
        alert(`Failed to send ${channel}`);
      }
    }
  
    const MONTHS = [
      "January", "February", "March", "April",
      "May", "June", "July", "August",
      "September", "October", "November", "December"
    ];

  return (
    <>
        <style>{printStyles}</style> 
        <div style={printMode ? styles.printWrapper : styles.wrapper}>
      
      {/* HEADER */}
      {!printMode && (
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Cause List</div>
            <div style={styles.sub}>
              Weekly & Monthly Hearing Schedule
            </div>
          </div>

          <div style={styles.actions}>
            <button onClick={downloadExcel} style={styles.secondaryBtn}>
              Download Excel
            </button>

            <button onClick={() => window.print()} style={styles.secondaryBtn}>
              Print
            </button>

            <button
              onClick={() => setPrintMode(!printMode)}
              style={styles.secondaryBtn}
            >
              {printMode ? "Exit Preview" : "Print Preview"}
            </button>

            <button
              onClick={openNotificationSetup}
              style={styles.secondaryBtn}
            >
              Notification Setup
            </button>

            <input
              type="file"
              onChange={handleUpload}
              style={{ display: "none" }}
              id="upload"
            />

            <button
              style={styles.secondaryBtn}
              onClick={() => document.getElementById("upload").click()}
            >
              Upload Tracker
            </button>
          </div>
        </div>
      )}

      {/* FILTERS */}
      {!printMode && (
        <div style={styles.filters}>
          <select value={view} onChange={(e) => setView(e.target.value)} style={styles.select}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>

          {view === "monthly" && (
            <>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                style={styles.select}
              >
                {MONTHS.map((name, i) => (
                  <option key={i + 1} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                style={styles.select}
              >
                {[2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </>
          )}

          {view === "weekly" && (
            <input
              type="date"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              style={styles.select}
            />
          )}

          <select value={client} onChange={(e) => setClient(e.target.value)} style={styles.select}>
            <option value="">All Clients</option>
            {clients.map((c, i) => (
              <option key={i}>{c}</option>
            ))}
          </select>
        </div>
      )}

      {/* FILES */}
      {!printMode && (
        <div style={styles.fileBox}>
          <div style={styles.fileTitle}>Uploaded Trackers</div>
          {files.map((f, i) => (
            <div key={i} style={styles.fileRow}>
              <div>{f.source_file}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {Array.isArray(f.clients) ? f.clients.join(", ") : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LIST */}
      <div style={styles.card}>
        {loading ? (
            <div style={styles.empty}>Loading...</div>
        ) : Object.keys(data).length === 0 ? (
            <div style={styles.empty}>No hearings found</div>
        ) : (
            Object.entries(data || {}).map(([date, districts]) => (
            <div key={date} style={styles.dateBlock} className="print-page">
                
                {/* DATE HEADER */}
                <div
                style={styles.courtTitle}
                className="court-title"
                onClick={() => toggleDate(date)}
                >
                {collapsedDates[date] ? "▶" : "▼"} CAUSE LIST FOR{" "}
                {formatDate(date).toUpperCase()}
                </div>

                {!collapsedDates[date] && (
                <>
                    {/* SUBTITLE ONCE */}
                    <div className="court-subtitle">
                    BEFORE THE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION
                    </div>

                    {Object.entries(districts || {}).map(([district, courts]) => (
                    <div key={district} style={styles.districtBlock}>
                        
                        <div style={styles.courtName}>
                        {district.toUpperCase()}
                        </div>

                        {Object.entries(courts).map(([court, matters]) => (
                        <div key={court} style={styles.courtBlock}>
                            
                            <div style={styles.courtHeader}>{court}</div>

                            {(Array.isArray(matters) ? matters : []).map((m, idx) => (
                            <div
                              key={m.id}
                              style={{
                                ...styles.caseRow,
                                cursor: m.linked_matter_id ? "pointer" : "default",
                                background:
                                  m.source === "matter"
                                    ? "#ecfeff"
                                    : m.source === "tracker"
                                    ? "#f8fafc"
                                    : "transparent",
                              }}
                                className="case-row"
                                onClick={() => {
                                  if (m.linked_matter_id) {
                                    navigate(`${basePath}/matters/${m.linked_matter_id}`);
                                  }
                                }}
                                >
                                
                                <div style={styles.caseIndex}>
                                {idx + 1}.
                                </div>

                                <div style={styles.caseContent}>
                                <div
                                  style={{
                                    ...styles.matter,
                                    cursor: "pointer",
                                    color: "#2563eb",
                                    textDecoration: "underline"
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (m.linked_matter_id) {
                                      navigate(`${basePath}/matters/${m.linked_matter_id}`);
                                    }
                                  }}
                                >
                                  {m.matter_name}
                                </div>

                                <div style={styles.meta}>
                                  Source: {
                                    m.source === "matter"
                                      ? "System Auto"
                                      : m.source === "tracker"
                                      ? "Uploaded Tracker"
                                      : "Unknown"
                                  }
                                </div>

                                    <div style={styles.meta}>
                                    Case No: {m.case_no}
                                    </div>

                                    <div style={styles.meta}>
                                    {m.client_name}
                                    </div>
              
                                <div style={styles.meta}>
                                Last Hearing:
                                <input
                                    type="date"
                                    value={m.ldoh ? String(m.ldoh).slice(0, 10) : ""}
                                    style={styles.inputInline}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) =>
                                    updateField(m.id, "ldoh", e.target.value)
                                    }
                                />
                                </div>

                                <input
                                  value={purposeMap[m.id] || ""}
                                  placeholder="Enter purpose"
                                  style={styles.input}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    const val = e.target.value;

                                    // update UI instantly
                                    setPurposeMap(prev => ({
                                      ...prev,
                                      [m.id]: val
                                    }));

                                    // save to backend (debounced)
                                    debouncedUpdate(m.id, "purpose", val);
                                  }}
                                />
                                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                                  Auto-saving...
                                </div>
                                <div style={{ fontSize: 11, marginTop: 2 }}>
                                  {savingMap[m.id] === "saving" && "Saving..."}
                                  {savingMap[m.id] === "saved" && "Saved ✓"}
                                  {savingMap[m.id] === "error" && "Error ❌"}
                                </div>

                                <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                                  <button
                                    style={styles.emailBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openSendModal(m, "email");
                                    }}
                                  >
                                    📧 Email
                                  </button>

                                  <button
                                    style={styles.smsBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openSendModal(m, "sms");
                                    }}
                                  >
                                    📲 SMS
                                  </button>

                                  <button
                                    style={styles.whatsappBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openSendModal(m, "whatsapp");
                                    }}
                                  >
                                    💬 WhatsApp
                                  </button>
                                </div>

                                <div style={{ marginTop: 10, display: "grid", gap: 6 }}>

                                  {/* 🔵 GNP COUNSEL */}
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280" }}>
                                    GNP COUNSEL
                                  </div>

                                  <input
                                    value={m.lawyer_name || ""}
                                    placeholder="Assign GNP Counsel"
                                    style={styles.input}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => updateLawyer(m.id, e.target.value)}
                                  />

                                  {/* 🟢 LOCATION COUNSEL */}
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginTop: 6 }}>
                                    LOCATION COUNSEL
                                  </div>

                                  <select
                                    value={m.counsel_id || ""}
                                    style={styles.select}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={async (e) => {
                                      const counselId = e.target.value;
                                      if (!counselId) return;

                                      try {
                                        const res = await fetch(`${API_BASE}/cause-list/assign-counsel`, {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                            Authorization: "Bearer " + localStorage.getItem("token"),
                                          },
                                          body: JSON.stringify({
                                            external_id: m.id,
                                            counsel_id: Number(counselId),
                                          }),
                                        });

                                        const result = await res.json();

                                        if (!res.ok) {
                                          alert(result.detail || "Failed to assign counsel");
                                          return;
                                        }

                                        loadData(); // 🔥 auto refresh everywhere
                                      } catch {
                                        alert("Failed to assign counsel");
                                      }
                                    }}
                                  >
                                    <option value="">Assign / Change Location Counsel</option>
                                    {counsels.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name} ({c.phone})
                                      </option>
                                    ))}
                                  </select>

                                  {m.counsel_name && (
                                    <div style={{ fontSize: 12, color: "#374151" }}>
                                      📍 {m.counsel_name} | 📞 {m.counsel_phone}
                                    </div>
                                  )}

                                </div>
                                </div>
                                <div style={styles.meta}>
                                Last Hearing: {formatDate(m.ldoh)}
                                </div>

                            </div>
                            ))}
                        </div>
                        ))}
                    </div>
                    ))}
                </>
                )}
            </div>
            ))
        )}
        </div>

      {printMode && (
        <div style={styles.printActions}>
          <button onClick={() => window.print()} style={styles.printBtn}>
            Print Now
          </button>

          <button onClick={() => setPrintMode(false)} style={styles.printBtn}>
            Exit Preview
          </button>
        </div>
      )}

      {setupModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalTitle}>Notification Setup</div>

            <div style={styles.modalGrid}>
              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={notificationSetup.emailConnected}
                  onChange={(e) =>
                    handleSetupField("emailConnected", e.target.checked)
                  }
                />
                <span>Enable Email</span>
              </label>

              <input
                placeholder="Sender Email"
                value={notificationSetup.senderEmail}
                onChange={(e) =>
                  handleSetupField("senderEmail", e.target.value)
                }
                style={styles.input}
              />

              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={notificationSetup.smsConnected}
                  onChange={(e) =>
                    handleSetupField("smsConnected", e.target.checked)
                  }
                />
                <span>Enable SMS</span>
              </label>

              <input
                placeholder="Sender Phone"
                value={notificationSetup.senderPhone}
                onChange={(e) =>
                  handleSetupField("senderPhone", e.target.value)
                }
                style={styles.input}
              />

              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={notificationSetup.whatsappConnected}
                  onChange={(e) =>
                    handleSetupField("whatsappConnected", e.target.checked)
                  }
                />
                <span>Enable WhatsApp</span>
              </label>

              <input
                placeholder="WiFi / Network Label"
                value={notificationSetup.wifiName}
                onChange={(e) =>
                  handleSetupField("wifiName", e.target.value)
                }
                style={styles.input}
              />
            </div>

            <div style={styles.modalActions}>
              <button style={styles.secondaryBtn} onClick={() => setSetupModalOpen(false)}>
                Cancel
              </button>
              <button style={styles.primaryBtn} onClick={saveSetupAndClose}>
                Save Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {sendModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalTitle}>
              Send {sendModal.channel.toUpperCase()}
            </div>

            <div style={styles.meta}>
              Counsel: {sendModal.matter.counsel_name || "-"}
            </div>
            <div style={styles.meta}>
              Phone: {sendModal.matter.counsel_phone || "-"}
            </div>
            <div style={styles.meta}>
              Email:
              <input
                type="text"
                value={sendModal.email || ""}
                onChange={(e) =>
                  setSendModal((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                style={{
                  marginLeft: 8,
                  padding: "4px 6px",
                  fontSize: 12,
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  width: "100%",
                }}
              />
            </div>
            <div style={styles.meta}>
              Matter: {sendModal.matter.matter_name || "-"}
            </div>

            <textarea
              value={sendModal.message}
              onChange={(e) =>
                setSendModal((prev) => ({
                  ...prev,
                  message: e.target.value,
                }))
              }
              style={styles.messageBox}
            />

            <div style={styles.modalActions}>
              <button style={styles.secondaryBtn} onClick={closeSendModal}>
                Cancel
              </button>
              <button style={styles.primaryBtn} onClick={confirmSend}>
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
   </>
  );
}

/* HELPERS */

function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB");
}

async function updateLawyer(id, value) {
  await fetch(`${API_BASE}/cause-list/${id}/lawyer`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token"),
    },
    body: JSON.stringify({ lawyer_name: value }),
  });
}

/* STYLES */

const styles = {
  wrapper: { display: "grid", gap: 20 },

  printWrapper: {
    padding: 40,
    background: "white",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: { fontSize: 22, fontWeight: 800 },
  sub: { fontSize: 13, color: "#6b7280" },

  actions: { display: "flex", gap: 10 },

  filters: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  select: {
    padding: 10,
    borderRadius: 10,
    border: "1px solid #d1d5db",
  },

  fileBox: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
  },

  fileTitle: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 8,
  },

  fileRow: {
    fontSize: 13,
    padding: "6px 0",
  },

  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    display: "grid",
    gap: 10,
  },

  dateBlock: {
    borderBottom: "2px solid #e5e7eb",
    paddingBottom: 10,
  },

  courtTitle: {
    fontSize: 18,
    fontWeight: 900,
    textAlign: "center",
    marginBottom: 8,
    cursor: "pointer",
    },

  courtName: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 6,
    textTransform: "uppercase",
    },

  courtBlock: {
    marginBottom: 10,
  },

  courtHeader: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 6,
  },

  caseRow: {
    display: "flex",
    gap: 12,
    padding: "6px 0",
    borderBottom: "1px dotted #ccc",
    cursor: "pointer",
  },

  caseIndex: {
    width: 40,
    fontWeight: 700,
    },

  caseContent: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    },

  matter: {
    fontWeight: 700,
  },

  meta: {
    fontSize: 12,
    color: "#6b7280",
  },

  empty: {
    textAlign: "center",
    padding: 20,
    color: "#6b7280",
  },

  printBtn: {
    padding: "10px 14px",
    background: "#111827",
    color: "white",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
  },

  districtBlock: {
    marginBottom: 12,
    breakInside: "avoid",
  },

  input: {
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    padding: "4px 6px",
    fontSize: 12,
  },

  inputInline: {
    marginLeft: 6,
    padding: "2px 6px",
    fontSize: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    },

  emailBtn: {
    padding: "4px 8px",
    fontSize: 12,
    borderRadius: 6,
    border: "1px solid #2563eb",
    background: "#eff6ff",
    color: "#2563eb",
    cursor: "pointer",
  },

  smsBtn: {
    padding: "4px 8px",
    fontSize: 12,
    borderRadius: 6,
    border: "1px solid #16a34a",
    background: "#f0fdf4",
    color: "#16a34a",
    cursor: "pointer",
  },

  printActions: {
    position: "fixed",
    top: 20,
    right: 20,
    display: "flex",
    gap: 10,
    zIndex: 1000,
  },

  whatsappBtn: {
    padding: "4px 8px",
    fontSize: 12,
    borderRadius: 6,
    border: "1px solid #22c55e",
    background: "#f0fdf4",
    color: "#15803d",
    cursor: "pointer",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000,
  },

  modalBox: {
    width: "min(680px, 92vw)",
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    display: "grid",
    gap: 12,
    boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#111827",
  },

  modalGrid: {
    display: "grid",
    gap: 10,
  },

  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },

  messageBox: {
    minHeight: 140,
    resize: "vertical",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
  },

};