import type { Json } from '@/lib/supabase/types';

export type UserTravelPreferences = {
    frequentDestinations?: string[];
    defaultBudget?: number | null;
    defaultTravelers?: number | null;
    interests?: string[];
    notes?: string | null;
};

export function normalizeUserPreferences(value: unknown): UserTravelPreferences | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const record = value as Record<string, unknown>;

    const normalizeStringArray = (input: unknown) => {
        if (!input) {
            return [] as string[];
        }
        if (Array.isArray(input)) {
            return input
                .filter((item): item is string => typeof item === 'string')
                .map((item) => item.trim())
                .filter(Boolean);
        }
        if (typeof input === 'string') {
            return input
                .split(/[，,\n]/)
                .map((item) => item.trim())
                .filter(Boolean);
        }
        return [] as string[];
    };

    const frequentDestinations = normalizeStringArray(record.frequentDestinations ?? record.favoriteDestinations);
    const interests = normalizeStringArray(record.interests);

    const defaultBudget = toNumber(record.defaultBudget);
    const defaultTravelers = toNumber(record.defaultTravelers);
    const notes = typeof record.notes === 'string' ? record.notes : null;

    return {
        frequentDestinations: frequentDestinations.length ? frequentDestinations : undefined,
        interests: interests.length ? interests : undefined,
        defaultBudget,
        defaultTravelers,
        notes,
    };
}

export function preferencesToJson(preferences: UserTravelPreferences | null): Json | null {
    if (!preferences) {
        return null;
    }

    return JSON.parse(JSON.stringify(preferences)) as Json;
}

export function sanitizeUserPreferences(preferences: UserTravelPreferences | null): UserTravelPreferences | null {
    if (!preferences) {
        return null;
    }

    const result: UserTravelPreferences = {};

    const dedupeList = (input?: string[]) => {
        if (!input || input.length === 0) {
            return [] as string[];
        }

        const items = input
            .map((item) => item.trim())
            .filter((item) => item.length > 0);

        const unique = Array.from(new Set(items));
        return unique.slice(0, 12);
    };

    const destinations = dedupeList(preferences.frequentDestinations);
    if (destinations.length > 0) {
        result.frequentDestinations = destinations;
    }

    const interests = dedupeList(preferences.interests);
    if (interests.length > 0) {
        result.interests = interests;
    }

    if (
        typeof preferences.defaultBudget === 'number' &&
        Number.isFinite(preferences.defaultBudget) &&
        preferences.defaultBudget > 0
    ) {
        result.defaultBudget = Math.round(preferences.defaultBudget);
    }

    if (
        typeof preferences.defaultTravelers === 'number' &&
        Number.isFinite(preferences.defaultTravelers) &&
        preferences.defaultTravelers > 0
    ) {
        result.defaultTravelers = Math.max(1, Math.round(preferences.defaultTravelers));
    }

    if (typeof preferences.notes === 'string') {
        const trimmed = preferences.notes.trim();
        if (trimmed.length > 0) {
            result.notes = trimmed.slice(0, 1000);
        }
    }

    return Object.keys(result).length > 0 ? result : null;
}

function toNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value.trim());
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}
