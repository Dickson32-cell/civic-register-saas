// Auth helper — reads the session from the httpOnly cookie on every request
import { cookies } from "next/headers";
import { verifySessionToken, tenantId } from "./db";

export const SESSION_COOKIE = "adweso_session";

export async function getSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

// The session's own tenant — every company only ever touches its own rows.
// Falls back to the deployment tenant for pre-migration sessions (self-heals
// on next login when the fresh token carries tenantId).
export function sTid(session: { tenantId?: string } | null | undefined): string {
  const t = (session as { tenantId?: string } | null)?.tenantId;
  return t || sTid(session);
}