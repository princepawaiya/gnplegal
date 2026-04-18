import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((toast) => {
    const id = crypto?.randomUUID?.() || String(Date.now() + Math.random());
    const t = {
      id,
      title: toast.title || "",
      message: toast.message || "",
      variant: toast.variant || "info", // info | success | error | warning
      timeout: toast.timeout ?? 2800,
    };

    setToasts((prev) => [...prev, t]);

    if (t.timeout > 0) {
      window.setTimeout(() => remove(id), t.timeout);
    }
  }, [remove]);

  const api = useMemo(() => ({ push, remove }), [push, remove]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider />");
  return ctx;
}

function tone(variant) {
  switch (variant) {
    case "success":
      return { bg: "#ecfdf5", border: "#10b981", fg: "#065f46", icon: "✅" };
    case "error":
      return { bg: "#fef2f2", border: "#ef4444", fg: "#7f1d1d", icon: "❌" };
    case "warning":
      return { bg: "#fffbeb", border: "#f59e0b", fg: "#92400e", icon: "⚠️" };
    default:
      return { bg: "#eff6ff", border: "#3b82f6", fg: "#1e3a8a", icon: "ℹ️" };
  }
}

function ToastViewport({ toasts, onClose }) {
  return (
    <div style={styles.viewport}>
      {toasts.map((t) => {
        const s = tone(t.variant);
        return (
          <div key={t.id} style={{ ...styles.toast, background: s.bg, borderColor: s.border, color: s.fg }}>
            <div style={styles.icon}>{s.icon}</div>
            <div style={{ minWidth: 0 }}>
              {t.title ? <div style={styles.title}>{t.title}</div> : null}
              <div style={styles.msg}>{t.message}</div>
            </div>
            <button onClick={() => onClose(t.id)} style={styles.close} aria-label="Close">
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  viewport: {
    position: "fixed",
    right: 18,
    bottom: 18,
    display: "grid",
    gap: 10,
    zIndex: 9999,
    width: 360,
    maxWidth: "calc(100vw - 36px)",
  },
  toast: {
    display: "grid",
    gridTemplateColumns: "24px 1fr 24px",
    gap: 10,
    alignItems: "start",
    border: "1px solid",
    borderRadius: 12,
    padding: 12,
    boxShadow: "0 10px 30px rgba(2,6,23,0.12)",
    animation: "toastIn 160ms ease-out",
  },
  icon: { width: 24, height: 24, display: "grid", placeItems: "center" },
  title: { fontWeight: 800, fontSize: 13, marginBottom: 2 },
  msg: { fontSize: 13, lineHeight: 1.35, opacity: 0.95, wordBreak: "break-word" },
  close: {
    width: 24,
    height: 24,
    borderRadius: 8,
    border: "1px solid rgba(15,23,42,0.15)",
    background: "rgba(255,255,255,0.55)",
    cursor: "pointer",
  },
};