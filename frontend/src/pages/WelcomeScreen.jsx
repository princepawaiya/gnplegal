import { useEffect, useState } from "react";

export default function WelcomeScreen({ onContinue }) {
  const user = JSON.parse(atob(localStorage.getItem("token").split(".")[1]));

  const quotes = [
    "Justice delayed is justice denied ⚖️",
    "Stay sharp. Stay consistent 🚀",
    "Every case is a step toward impact 💼",
    "Precision and persistence win cases ⚖️",
    "Your work shapes real outcomes 🔥",
  ];

  const emojis = ["⚖️", "🚀", "💼", "📚", "🔥"];

  const [quote, setQuote] = useState("");
  const [emoji, setEmoji] = useState("");

  useEffect(() => {
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
    setEmoji(emojis[Math.floor(Math.random() * emojis.length)]);
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.overlay}></div>

      <div style={styles.card}>
        {/* LOGO / BRAND */}
        <div style={styles.logo}>GNP Legal</div>

        {/* GREETING */}
        <h1 style={styles.heading}>
          Welcome, {user.full_name} {emoji}
        </h1>

        <p style={styles.subtext}>
          Ready to take control of your cases today?
        </p>

        {/* QUOTE */}
        <div style={styles.quoteBox}>
          <span style={styles.quoteIcon}>💡</span>
          <span>{quote}</span>
        </div>

        {/* BOT */}
        <div style={styles.bot}>
          🤖 <span style={{ marginLeft: 6 }}>GNP Legal Assistant Active</span>
        </div>

        {/* BUTTON */}
        <button onClick={onContinue} style={styles.btn}>
          Enter Dashboard →
        </button>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const styles = {
  page: {
    height: "100vh",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    background:
      "linear-gradient(135deg, #1e3a8a 0%, #6d28d9 50%, #9333ea 100%)",
    fontFamily: "Inter, sans-serif",
  },

  overlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backdropFilter: "blur(40px)",
    opacity: 0.2,
  },

  card: {
    position: "relative",
    background: "rgba(255,255,255,0.1)",
    backdropFilter: "blur(20px)",
    padding: "40px 50px",
    borderRadius: 20,
    textAlign: "center",
    color: "white",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
    maxWidth: 480,
    width: "90%",
  },

  logo: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 1,
    opacity: 0.8,
    marginBottom: 10,
  },

  heading: {
    fontSize: 26,
    fontWeight: 700,
    marginBottom: 6,
  },

  subtext: {
    fontSize: 14,
    opacity: 0.85,
    marginBottom: 20,
  },

  quoteBox: {
    background: "rgba(255,255,255,0.15)",
    padding: "12px 16px",
    borderRadius: 12,
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    marginBottom: 20,
  },

  quoteIcon: {
    fontSize: 16,
  },

  bot: {
    fontSize: 13,
    opacity: 0.9,
    marginBottom: 20,
  },

  btn: {
    padding: "12px 18px",
    borderRadius: 10,
    border: "none",
    background: "white",
    color: "#4f46e5",
    fontWeight: 600,
    cursor: "pointer",
    transition: "0.2s",
  },
};