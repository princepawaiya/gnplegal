const API_BASE = "";

export async function getMatters() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_BASE}/matters/list`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
}