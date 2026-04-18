export type FilterPreference = "calm" | "moderate" | "all";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
};

export type UserPreferenceRecord = {
  userId: string;
  tolerance: FilterPreference;
  category: string;
  updatedAt: number;
};

type DatabaseState = {
  usersById: Map<string, UserRecord>;
  usersByEmail: Map<string, UserRecord>;
  preferencesByUserId: Map<string, UserPreferenceRecord>;
};

const DB_STATE_KEY = Symbol.for("quiethours.auth.db.state");

function getState(): DatabaseState {
  const globalObj = globalThis as typeof globalThis & {
    [DB_STATE_KEY]?: DatabaseState;
  };
  if (!globalObj[DB_STATE_KEY]) {
    globalObj[DB_STATE_KEY] = {
      usersById: new Map<string, UserRecord>(),
      usersByEmail: new Map<string, UserRecord>(),
      preferencesByUserId: new Map<string, UserPreferenceRecord>(),
    };
  }
  return globalObj[DB_STATE_KEY];
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const state = getState();
  return state.usersByEmail.get(email.toLowerCase()) ?? null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const state = getState();
  return state.usersById.get(id) ?? null;
}

export async function createUser(user: UserRecord): Promise<void> {
  const state = getState();
  const normalizedEmail = user.email.toLowerCase();
  if (state.usersByEmail.has(normalizedEmail)) {
    throw new Error("User already exists");
  }
  state.usersById.set(user.id, { ...user, email: normalizedEmail });
  state.usersByEmail.set(normalizedEmail, { ...user, email: normalizedEmail });
}

export async function getUserPreferences(userId: string): Promise<UserPreferenceRecord | null> {
  const state = getState();
  return state.preferencesByUserId.get(userId) ?? null;
}

export async function saveUserPreferences(input: {
  userId: string;
  tolerance: FilterPreference;
  category: string;
}): Promise<UserPreferenceRecord> {
  const state = getState();
  const next: UserPreferenceRecord = {
    userId: input.userId,
    tolerance: input.tolerance,
    category: input.category,
    updatedAt: Date.now(),
  };
  state.preferencesByUserId.set(input.userId, next);
  return next;
}
