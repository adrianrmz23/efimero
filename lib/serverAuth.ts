import { cookies } from "next/headers";

export const EFIMERO_SESSION_COOKIE = "efimero_session";

export type EfimeroServerUser = {
  id: string;
  email: string;
  accessToken: string;
};

export async function getServerUser(): Promise<EfimeroServerUser | null> {
  const store = await cookies();
  const token = store.get(EFIMERO_SESSION_COOKIE)?.value || "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  if (!user?.id || !user?.email) return null;
  return { id: String(user.id), email: String(user.email), accessToken: token };
}
