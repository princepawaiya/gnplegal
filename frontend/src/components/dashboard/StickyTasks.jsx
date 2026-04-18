import { useEffect, useState } from "react";
import { getGNPCounselCases } from "../../services/gnpCounselApi";

export default function StickyTasks({ compact = false }) {
  const [tasks, setTasks] = useState([]);
  const [autoTasks, setAutoTasks] = useState([]);
  const [newTask, setNewTask] = useState("");

  useEffect(() => {
    loadTasks();
    loadAutoTasks();
  }, []);

  useEffect(() => {
    const interval = setInterval(remindTasks, 3600000);
    return () => clearInterval(interval);
  }, []);

  /* ================= LOAD MANUAL TASKS ================= */
  async function loadTasks() {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/tasks`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      if (!res.ok) throw new Error();

      const json = await res.json();   // ✅ DEFINE FIRST

      console.log("TASK API RAW:", json);  // ✅ AFTER definition

      const data =
        Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.items)
          ? json.items
          : [];

      console.log("FINAL TASKS:", data);

      setTasks(data);
    } catch (e) {
      console.error("LOAD TASK ERROR:", e);
      setTasks([]);
    }
  }

  /* ================= AUTO TASK ENGINE ================= */
  async function loadAutoTasks() {
    try {
      const cases = await getGNPCounselCases();

      const generated = [];

      cases.forEach((c) => {
        const flags = c.flags || [];

        // 🔴 Hearing soon
        if (flags.includes("HEARING_SOON")) {
          generated.push({
            id: "auto-" + c.id + "-hearing",
            task_text: `Prepare for hearing (${c.case_no})`,
            priority: "critical",
            is_done: false,
            is_auto: true,
          });
        }

        // 🔴 Reply required
        if ((c.next_action || "").includes("Reply")) {
          generated.push({
            id: "auto-" + c.id + "-reply",
            task_text: `File reply (${c.case_no})`,
            priority: "high",
            is_done: false,
            is_auto: true,
          });
        }

        // 🔴 No next date
        if (flags.includes("NO_NEXT_DATE")) {
          generated.push({
            id: "auto-" + c.id + "-ndoh",
            task_text: `Update next date (${c.case_no})`,
            priority: "high",
            is_done: false,
            is_auto: true,
          });
        }

        // 🔴 Stale
        if (flags.includes("STALE_7_DAYS")) {
          generated.push({
            id: "auto-" + c.id + "-stale",
            task_text: `Follow up case (${c.case_no})`,
            priority: "medium",
            is_done: false,
            is_auto: true,
          });
        }
      });

      setAutoTasks(generated);
    } catch {
      setAutoTasks([]);
    }
  }

  /* ================= ADD TASK ================= */
  async function addTask() {
    if (!newTask.trim()) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/tasks`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task_text: newTask,
        }),
      });

      const raw = await res.json();

      const saved = raw?.data || raw;

      console.log("FINAL SAVED:", saved);

      if (!res.ok) throw new Error();

      // ✅ DIRECT INSERT (THIS IS THE REAL FIX)
      setTasks((prev) => [
        {
          id: saved.id || Date.now(),   // fallback safety
          task_text: saved.task_text,
          is_done: false,
          priority: saved.priority || "normal",
          is_auto: false,
        },
        ...prev,
      ]);

      setNewTask("");

    } catch (e) {
      console.error(e);
      alert("Failed to add task");
    }
  }

  /* ================= TOGGLE ================= */
  async function toggleTask(id, done) {
    // update both
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, is_done: done } : t
      )
    );

    // persist only real tasks
    if (typeof id !== "number") return;

    try {
      await fetch(
        `${import.meta.env.VITE_API_URL}/tasks/${id}?is_done=${done}`,
        {
          method: "PUT",
          headers: {
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
        }
      );
    } catch {
      // rollback
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, is_done: !done } : t
        )
      );
    }
  }

  /* ================= DELETE ================= */
  async function deleteTask(id) {
    if (typeof id !== "number") return;

    setTasks((prev) => prev.filter((t) => t.id !== id));

    try {
      await fetch(`${import.meta.env.VITE_API_URL}/tasks/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });
    } catch {
      loadTasks();
    }
  }

  /* ================= REMINDER ================= */
  function remindTasks() {
    const all = [...tasks, ...autoTasks];
    const pending = all.filter((t) => !t?.is_done);

    document.title =
      pending.length > 0
        ? `⏰ ${pending.length} pending tasks`
        : "GNP Legal";
  }

  /* ================= PRIORITY ================= */
  function getPriorityStyle(priority) {
    switch (priority) {
      case "critical":
        return { color: "#dc2626" };
      case "high":
        return { color: "#f59e0b" };
      case "medium":
        return { color: "#2563eb" };
      default:
        return {};
    }
  }

  /* ================= MERGE TASKS ================= */
  const merged = [...tasks, ...autoTasks].sort((a, b) => {
    const rank = { critical: 1, high: 2, medium: 3, normal: 4 };
    return (rank[a.priority] || 5) - (rank[b.priority] || 5);
  });

  console.log("TASKS:", tasks);
  console.log("AUTO:", autoTasks);
  console.log("MERGED:", merged);
  console.log("RENDER TASKS:", tasks);

  return (
    <div style={{ ...styles.card, padding: compact ? 10 : 16 }}>
      <div style={styles.header}>
        <div style={styles.title}>🧠 Smart Tasks</div>
        <div style={styles.sub}>
          Auto-generated from legal workflow
        </div>
      </div>

      <div style={styles.list}>
        {merged.length === 0 ? (
          <div style={styles.empty}>No tasks 🎉</div>
        ) : (
          merged.slice(0, compact ? 4 : merged.length).map((t, i) => (
            <div key={`${t.id}-${t.is_auto}`} style={styles.row}>

              <input
                type="checkbox"
                checked={!!t.is_done}
                onChange={(e) => toggleTask(t.id, e.target.checked)}
              />

              <div style={{ flex: 1 }}>
                {/* DEBUG (safe) */}
                <div style={{ fontSize: 10, color: "#9ca3af" }}>
                  {t.id} | {t.is_auto ? "AUTO" : "MANUAL"}
                </div>
                <div
                  style={{
                    ...styles.text,
                    ...getPriorityStyle(t.priority),
                  }}
                >
                  {i + 1}. {t.task_text}
                </div>
                {t.is_done && <div style={styles.doneTag}>DONE</div>}

                {t.is_auto && (
                  <div style={styles.autoTag}>AUTO</div>
                )}
              </div>

              {!t.is_auto && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();   // ✅ ADD THIS
                    deleteTask(t.id);
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div style={styles.inputRow}>
        <input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Add task..."
          style={styles.input}
        />

        <button onClick={addTask} style={styles.btn}>
          +
        </button>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const styles = {
  card: { background: "#fff9c4", borderRadius: 12 },
  header: { display: "flex", flexDirection: "column" },
  title: { fontWeight: 700, fontSize: 13 },
  sub: { fontSize: 11, color: "#64748b" },
  list: { display: "grid", gap: 4, marginTop: 6 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(255,255,255,0.6)",
    padding: "6px 8px",
    borderRadius: 8,
  },
  text: { fontSize: 13 },
  autoTag: {
    fontSize: 10,
    background: "#e0f2fe",
    padding: "2px 6px",
    borderRadius: 6,
    marginTop: 2,
  },
  deleteBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: "#ef4444",
  },
  inputRow: { display: "flex", gap: 6, marginTop: 8 },
  input: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
  },
  btn: {
    background: "#f59e0b",
    color: "white",
    border: "none",
    padding: "6px 10px",
    borderRadius: 8,
    cursor: "pointer",
  },
  empty: { fontSize: 12, color: "#64748b" },

  doneTag: {
    fontSize: 10,
    background: "#dcfce7",
    color: "#166534",
    padding: "2px 6px",
    borderRadius: 6,
    marginTop: 2,
    display: "inline-block",
  },
};