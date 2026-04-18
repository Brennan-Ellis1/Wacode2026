import { clearSession, useSession } from "@tanstack/react-start/server";

const FALLBACK_SESSION_SECRET = "quiet-hours-local-dev-secret-change-me-quiet-hours";

function sessionPassword() {
  const fromEnv =
    typeof process !== "undefined" && process.env ? process.env.SESSION_SECRET : undefined;
  return fromEnv && fromEnv.length >= 32 ? fromEnv : FALLBACK_SESSION_SECRET;
}

export const SESSION_CONFIG = {
  password: sessionPassword(),
  name: "quiet-hours-auth",
  maxAge: 60 * 60 * 24 * 14,
  cookie: {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: typeof process !== "undefined" ? process.env.NODE_ENV === "production" : false,
  },
};

export type AuthSessionData = {
  userId?: string;
};

export async function getAuthSession() {
  return useSession<AuthSessionData>(SESSION_CONFIG);
}

export async function clearAuthSession() {
  await clearSession(SESSION_CONFIG);
}
