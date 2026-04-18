export function getUserFromToken() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");

    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );

    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function hasPermission(permission) {
  const user = getUserFromToken();

  if (!user) return false;

  const role = (user.role || "").toLowerCase().trim();

  // ✅ FULL ACCESS ROLES
  if (role === "admin" || role === "gnp counsel") return true;

  const permissions = user.permissions;

  if (!permissions) return false;

  // ✅ ARRAY FORMAT
  if (Array.isArray(permissions)) {
    return permissions
      .map((p) => String(p).toLowerCase())
      .includes(String(permission).toLowerCase());
  }

  // ✅ OBJECT FORMAT
  if (typeof permissions === "object") {
    if (permissions["*"] === true || permissions["*"] === 1) return true;
    return permissions[permission] === true || permissions[permission] === 1;
  }

  return false;
}