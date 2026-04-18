import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100);
  }, []);

 async function handleLogin(e) {
  e.preventDefault();

  if (!email || !password) {
    alert("Email and password required");
    return;
  }

  try {
  setLoading(true);

  // 🔥 CLEAR OLD TOKEN BEFORE LOGIN
  localStorage.removeItem("token");
    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    });

    console.log("LOGIN URL:", `${API_BASE}/auth/login`);

    console.log("LOGIN RESPONSE STATUS:", res.status);

    let data;

    try {
      data = await res.json();
    } catch {
      throw new Error("Invalid server response (not JSON)");
    }

    console.log("LOGIN RESPONSE DATA:", data);

    if (!res.ok) throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : JSON.stringify(data.detail)
    );

    if (!data.access_token) {
      alert("No token received");
      return;
    }

    // ✅ Save token
    localStorage.setItem("token", data.access_token);

    console.log("TOKEN SAVED:", data.access_token);

    // ✅ Decode safely
    function decodeToken(token) {
      try {
        const base64 = token.split(".")[1]
          .replace(/-/g, "+")
          .replace(/_/g, "/");

        const json = decodeURIComponent(
          atob(base64)
            .split("")
            .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );

        return JSON.parse(json);
      } catch {
        return null;
      }
    }

    // ✅ ACTUALLY USE IT
    const payload = decodeToken(data.access_token);

    console.log("TOKEN PAYLOAD:", payload);

    if (!payload) {
      alert("Invalid token");
      localStorage.removeItem("token");
      return;
    }

    // ✅ AFTER TOKEN DECODE SUCCESS

    window.location.href = "/dashboard";

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    alert(err.message);
  } finally {
    setLoading(false);
  }
}

  return (
    <div style={{
      ...styles.wrapper,
      opacity: loaded ? 1 : 0,
      transition: "opacity 0.8s ease"
    }}>
      <div style={{
        ...styles.card,
        transform: loaded ? "translateY(0px)" : "translateY(20px)",
        opacity: loaded ? 1 : 0,
        transition: "all 0.8s ease"
      }}>

        {/* LOGO */}
        <img
          src="/logo.png"
          alt="NIA Consumer Litigation Manager"
          style={{
            ...styles.logo,
            transform: loaded ? "scale(1)" : "scale(0.95)",
            opacity: loaded ? 1 : 0,
            transition: "all 1s ease"
          }}
        />

        <div style={styles.title}>
          Consumer Litigation Manager
        </div>

        <div style={styles.subtitle}>
          Secure Enterprise Litigation Platform
        </div>

        <form onSubmit={handleLogin} style={styles.form}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <div style={styles.signupText}>
          Don’t have an account?{" "}
          <span
            style={styles.signupLink}
            onClick={() => navigate("/signup")}
          >
            Sign Up
          </span>
        </div>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const styles = {
  wrapper: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  card: {
    background: "white",
    padding: "55px 45px",
    borderRadius: 20,
    width: 420,
    boxShadow: "0 30px 80px rgba(0,0,0,0.25)",
    textAlign: "center",
  },

  logo: {
    width: 140,
    marginBottom: 25,
  },

  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#111827",
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 30,
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  input: {
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    fontSize: 14,
    transition: "all 0.2s ease",
  },

  button: {
    padding: "12px",
    borderRadius: 10,
    border: "none",
    background: "#1e3a8a",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
    transition: "all 0.2s ease",
  },

  signupText: {
    marginTop: 16,
    fontSize: 13,
    color: "#6b7280",
  },

  signupLink: {
    color: "#2563eb",
    fontWeight: 600,
    cursor: "pointer",
  },
};