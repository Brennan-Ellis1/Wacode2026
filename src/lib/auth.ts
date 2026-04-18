import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createUser,
  findUserByEmail,
  findUserById,
  getUserPreferences,
  saveUserPreferences,
  type FilterPreference,
} from "@/lib/db";
import { clearAuthSession, getAuthSession } from "@/lib/session";

const PASSWORD_MIN_LENGTH = 8;
const MAX_AUTH_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

const rateLimitMapKey = Symbol.for("quiethours.auth.rate.limit");

type AttemptMap = Map<string, number[]>;

function getAttemptMap(): AttemptMap {
  const globalObj = globalThis as typeof globalThis & { [rateLimitMapKey]?: AttemptMap };
  if (!globalObj[rateLimitMapKey]) {
    globalObj[rateLimitMapKey] = new Map();
  }
  return globalObj[rateLimitMapKey];
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, savedHex] = stored.split(":");
  if (!salt || !savedHex) return false;
  const computed = scryptSync(password, salt, 64);
  const saved = Buffer.from(savedHex, "hex");
  if (computed.length !== saved.length) return false;
  return timingSafeEqual(computed, saved);
}

function registerAttempt(key: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const attempts = getAttemptMap();
  const list = attempts.get(key) ?? [];
  const recent = list.filter((ts) => now - ts < ATTEMPT_WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
  if (recent.length > MAX_AUTH_ATTEMPTS) {
    const retryAfterMs = ATTEMPT_WINDOW_MS - (now - recent[0]);
    return { allowed: false, retryAfterMs: Math.max(1000, retryAfterMs) };
  }
  return { allowed: true, retryAfterMs: 0 };
}

function clearAttempts(key: string) {
  getAttemptMap().delete(key);
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(128),
});

const loginSchema = signupSchema;

const preferenceSchema = z.object({
  tolerance: z.enum(["calm", "moderate", "all"]),
  category: z.string().min(1).max(64),
});

export type AuthUser = {
  id: string;
  email: string;
};

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getAuthSession();
  if (!session.data.userId) return null;
  const user = await findUserById(session.data.userId);
  if (!user) {
    await session.clear();
    return null;
  }
  return { id: user.id, email: user.email } satisfies AuthUser;
});

export const signup = createServerFn({ method: "POST" })
  .inputValidator(signupSchema)
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email);
    const rateKey = `signup:${email}`;
    const attempt = registerAttempt(rateKey);
    if (!attempt.allowed) {
      throw new Error(`Too many attempts. Try again in ${Math.ceil(attempt.retryAfterMs / 1000)}s.`);
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      throw new Error("An account with this email already exists.");
    }

    const userId = randomUUID();
    const passwordHash = hashPassword(data.password);
    await createUser({
      id: userId,
      email,
      passwordHash,
      createdAt: Date.now(),
    });

    const session = await getAuthSession();
    await session.update({ userId });
    clearAttempts(rateKey);

    return { ok: true, user: { id: userId, email } satisfies AuthUser };
  });

export const login = createServerFn({ method: "POST" })
  .inputValidator(loginSchema)
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email);
    const rateKey = `login:${email}`;
    const attempt = registerAttempt(rateKey);
    if (!attempt.allowed) {
      throw new Error(`Too many attempts. Try again in ${Math.ceil(attempt.retryAfterMs / 1000)}s.`);
    }

    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(data.password, user.passwordHash)) {
      throw new Error("Invalid email or password.");
    }

    const session = await getAuthSession();
    await session.update({ userId: user.id });
    clearAttempts(rateKey);

    return { ok: true, user: { id: user.id, email: user.email } satisfies AuthUser };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await clearAuthSession();
  return { ok: true };
});

export const loadPreferenceForCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getAuthSession();
  if (!session.data.userId) return null;
  const pref = await getUserPreferences(session.data.userId);
  if (!pref) return null;
  return {
    tolerance: pref.tolerance,
    category: pref.category,
    updatedAt: pref.updatedAt,
  };
});

export const savePreferenceForCurrentUser = createServerFn({ method: "POST" })
  .inputValidator(preferenceSchema)
  .handler(async ({ data }) => {
    const session = await getAuthSession();
    if (!session.data.userId) {
      throw new Error("Sign in to save preferences.");
    }
    const saved = await saveUserPreferences({
      userId: session.data.userId,
      tolerance: data.tolerance as FilterPreference,
      category: data.category,
    });
    return {
      tolerance: saved.tolerance,
      category: saved.category,
      updatedAt: saved.updatedAt,
    };
  });
