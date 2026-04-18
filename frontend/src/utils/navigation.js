import { getUserFromToken } from "./permissions";

export function getBasePath() {
  const user = getUserFromToken();

  if (!user) return "";

  if (user.role === "admin") return "/admin";
  if (user.role === "lawyer") return "/lawyer";
  if (user.role === "client") return "/client";

  return "";
}