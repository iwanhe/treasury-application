export type Company = { id: string; code: string; name: string; roles: string[] };
export type Rule = {
  id: string; companyId: string | null; requestType: string; sequence: number; currencyCode: string;
  minAmount: string; maxAmount: string | null; approverRoleCode: string | null; approverUserId: string | null;
  isActive: boolean; createdAt: string; updatedAt: string;
};
const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
let tokenProvider: () => string | undefined = () => undefined;
export function setTokenProvider(provider: () => string | undefined) { tokenProvider = provider; }
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenProvider();
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}