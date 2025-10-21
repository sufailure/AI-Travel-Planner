export const API_KEYS_STORAGE_KEY = 'ai-travel-planner.api-keys';
export const ACTIVE_LLM_KEY_STORAGE_KEY = 'ai-travel-planner.llm-active-key';

export type StoredApiKey = {
    id: string;
    label: string;
    value: string;
    createdAt: number;
};

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeParseEntries = (raw: string | null): StoredApiKey[] => {
    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter((candidate): candidate is StoredApiKey => {
            if (!candidate || typeof candidate !== 'object') {
                return false;
            }

            const item = candidate as Partial<StoredApiKey>;
            return (
                typeof item.id === 'string' &&
                typeof item.label === 'string' &&
                typeof item.value === 'string' &&
                typeof item.createdAt === 'number'
            );
        });
    } catch (error) {
        console.warn('Failed to parse stored API keys:', error);
        return [];
    }
};

export const loadStoredApiKeys = (): StoredApiKey[] => {
    if (!isBrowser()) {
        return [];
    }

    const raw = window.localStorage.getItem(API_KEYS_STORAGE_KEY);
    return safeParseEntries(raw);
};

export const persistStoredApiKeys = (entries: StoredApiKey[]) => {
    if (!isBrowser()) {
        return;
    }

    try {
        window.localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
        console.warn('Failed to persist API keys:', error);
    }
};

export const loadActiveLlmKeyId = (): string | null => {
    if (!isBrowser()) {
        return null;
    }

    try {
        return window.localStorage.getItem(ACTIVE_LLM_KEY_STORAGE_KEY);
    } catch (error) {
        console.warn('Failed to read active LLM key id:', error);
        return null;
    }
};

export const persistActiveLlmKeyId = (id: string | null) => {
    if (!isBrowser()) {
        return;
    }

    try {
        if (id) {
            window.localStorage.setItem(ACTIVE_LLM_KEY_STORAGE_KEY, id);
        } else {
            window.localStorage.removeItem(ACTIVE_LLM_KEY_STORAGE_KEY);
        }
    } catch (error) {
        console.warn('Failed to persist active LLM key id:', error);
    }
};

export const resolveActiveLlmKeyValue = (
    cachedEntries?: StoredApiKey[],
): { id: string | null; value: string | null } => {
    const entries = cachedEntries ?? loadStoredApiKeys();
    if (entries.length === 0) {
        return { id: null, value: null };
    }

    const activeId = loadActiveLlmKeyId();
    if (!activeId) {
        return { id: entries[0].id, value: entries[0].value };
    }

    const target = entries.find((entry) => entry.id === activeId);
    if (!target) {
        return { id: entries[0].id, value: entries[0].value };
    }

    return { id: target.id, value: target.value };
};

export const upsertStoredApiKey = (
    existing: StoredApiKey[],
    payload: { id?: string; label: string; value: string; createdAt?: number },
): StoredApiKey[] => {
    const normalizedLabel = payload.label.trim();
    const normalizedValue = payload.value.trim();
    const timestamp = payload.createdAt ?? Date.now();

    const ensureId = () => {
        if (payload.id) {
            return payload.id;
        }
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    };

    const nextEntries = [...existing];
    const matchIndex = payload.id
        ? nextEntries.findIndex((item) => item.id === payload.id)
        : nextEntries.findIndex((item) => item.label === normalizedLabel);

    if (matchIndex >= 0) {
        nextEntries[matchIndex] = {
            ...nextEntries[matchIndex],
            label: normalizedLabel || nextEntries[matchIndex].label,
            value: normalizedValue,
            createdAt: timestamp,
        };
    } else {
        nextEntries.unshift({
            id: ensureId(),
            label: normalizedLabel || '未命名密钥',
            value: normalizedValue,
            createdAt: timestamp,
        });
    }

    return nextEntries;
};

export const removeStoredApiKey = (existing: StoredApiKey[], id: string): StoredApiKey[] => {
    const nextEntries = existing.filter((item) => item.id !== id);

    if (!isBrowser()) {
        return nextEntries;
    }

    const activeId = loadActiveLlmKeyId();
    if (activeId && activeId === id) {
        persistActiveLlmKeyId(nextEntries[0]?.id ?? null);
    }

    return nextEntries;
};
