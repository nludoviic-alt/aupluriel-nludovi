export const api = {
  async get<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error("API GET Error");
    return res.json();
  },
  async post<T>(url: string, body?: any): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("API POST Error");
    return res.json();
  },
  async put<T>(url: string, body?: any): Promise<T> {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("API PUT Error");
    return res.json();
  },
  async delete<T>(url: string): Promise<T> {
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) throw new Error("API DELETE Error");
    return res.json();
  },
};

export function clearToken() {
  localStorage.removeItem("token");
}
