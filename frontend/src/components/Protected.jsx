import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL;

// ✅ SAFE JWT DECODE
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

export default function Protected({ children, requiredPermission = null }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  function checkAuth() {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setAuthorized(false);
        return;
      }

      const payload = decodeToken(token);

      if (!payload) {
        setAuthorized(false);
        return;
      }

      const now = Date.now() / 1000;

      if (payload.exp && payload.exp < now) {
        localStorage.removeItem("token");
        setAuthorized(false);
        return;
      }

      const role = (payload.role || "").toLowerCase().trim();

      // ✅ FULL ACCESS ROLES
      if (role === "admin" || role === "gnp counsel") {
        setAuthorized(true);
        return;
      }

      // ✅ If no permission required
      if (!requiredPermission) {
        setAuthorized(true);
        return;
      }

      const permissions = payload.permissions;

      let allowed = false;

      // ✅ ARRAY FORMAT
      if (Array.isArray(permissions)) {
        allowed = permissions
          .map(p => String(p).toLowerCase())
          .includes(requiredPermission.toLowerCase());
      }

      // ✅ OBJECT FORMAT
      else if (permissions && typeof permissions === "object") {
        allowed =
          permissions[requiredPermission] === true ||
          permissions[requiredPermission] === 1;
      }

      setAuthorized(allowed);

    } catch (err) {
      console.error("Auth check failed", err);
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 20 }}>Checking access...</div>;
  }

  if (!authorized) {
    const token = localStorage.getItem("token");

    if (!token) {
      return <Navigate to="/login" replace />;
    }

    const payload = decodeToken(token);
    const role = (payload?.role || "").toLowerCase().trim();

    console.log("PERMISSIONS:", payload?.permissions);

    if (role === "admin") return <Navigate to="/admin" replace />;
    if (role === "lawyer") return <Navigate to="/lawyer" replace />;
    if (role === "gnp counsel") return <Navigate to="/gnp/dashboard" replace />;
    if (role === "client") return <Navigate to="/client" replace />;

    return <Navigate to="/login" replace />;
  }

  return children;
}