'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw, Save } from 'lucide-react';
import type { UserTravelPreferences } from '@/lib/types/preferences';
import { sanitizeUserPreferences } from '@/lib/types/preferences';

type PreferencesPanelProps = {
    initialPreferences: UserTravelPreferences | null;
};

type PreferencesResponse = {
    data: UserTravelPreferences | null;
};

export function PreferencesPanel({ initialPreferences }: PreferencesPanelProps) {
    const [frequentDestinations, setFrequentDestinations] = useState('');
    const [interests, setInterests] = useState('');
    const [defaultBudget, setDefaultBudget] = useState('');
    const [defaultTravelers, setDefaultTravelers] = useState('');
    const [notes, setNotes] = useState('');
    const [lastSaved, setLastSaved] = useState<UserTravelPreferences | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const applyPreferencesToForm = useCallback((preferences: UserTravelPreferences | null) => {
        setFrequentDestinations(listToTextarea(preferences?.frequentDestinations));
        setInterests(listToTextarea(preferences?.interests));
        setDefaultBudget(preferences?.defaultBudget ? String(preferences.defaultBudget) : '');
        setDefaultTravelers(preferences?.defaultTravelers ? String(preferences.defaultTravelers) : '');
        setNotes(preferences?.notes ?? '');
    }, []);

    useEffect(() => {
        const sanitized = sanitizeUserPreferences(initialPreferences);
        setLastSaved(sanitized);
        applyPreferencesToForm(sanitized);
    }, [initialPreferences, applyPreferencesToForm]);

    const buildPreferencesFromState = useCallback((): UserTravelPreferences | null => {
        const destinations = parseListInput(frequentDestinations);
        const interestTags = parseListInput(interests);
        const budgetValue = parsePositiveNumber(defaultBudget);
        const travelersValue = parsePositiveInteger(defaultTravelers);
        const noteText = notes.trim();

        const payload: UserTravelPreferences = {};

        if (destinations.length > 0) {
            payload.frequentDestinations = destinations;
        }

        if (interestTags.length > 0) {
            payload.interests = interestTags;
        }

        if (budgetValue != null) {
            payload.defaultBudget = budgetValue;
        }

        if (travelersValue != null) {
            payload.defaultTravelers = travelersValue;
        }

        if (noteText.length > 0) {
            payload.notes = noteText;
        }

        return Object.keys(payload).length > 0 ? payload : null;
    }, [frequentDestinations, interests, defaultBudget, defaultTravelers, notes]);

    const sanitizedCurrent = useMemo(() => {
        return sanitizeUserPreferences(buildPreferencesFromState());
    }, [buildPreferencesFromState]);

    const hasChanges = useMemo(() => {
        const previous = sanitizeUserPreferences(lastSaved);
        return JSON.stringify(previous ?? null) !== JSON.stringify(sanitizedCurrent ?? null);
    }, [lastSaved, sanitizedCurrent]);

    const handleReset = useCallback(() => {
        applyPreferencesToForm(lastSaved);
        setSuccessMessage(null);
        setErrorMessage(null);
    }, [applyPreferencesToForm, lastSaved]);

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        setSuccessMessage(null);
        setErrorMessage(null);

        const requestPayload = buildRequestPayload({
            frequentDestinations,
            interests,
            defaultBudget,
            defaultTravelers,
            notes,
        });

        try {
            const response = await fetch('/api/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload),
            });

            if (!response.ok) {
                const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                throw new Error(payload?.error ?? '保存偏好失败，请稍后重试。');
            }

            const payload = (await response.json()) as PreferencesResponse;
            const sanitized = sanitizeUserPreferences(payload.data);
            setLastSaved(sanitized);
            applyPreferencesToForm(sanitized);
            if (typeof window !== 'undefined') {
                window.dispatchEvent(
                    new CustomEvent<UserTravelPreferences | null>('user-preferences-updated', {
                        detail: sanitized ?? null,
                    }),
                );
            }
            setSuccessMessage('偏好已更新，下次生成行程时会自动引用。');
        } catch (error) {
            const message = error instanceof Error ? error.message : '保存偏好时出现未知错误。';
            setErrorMessage(message);
        } finally {
            setIsSaving(false);
        }
    }, [frequentDestinations, interests, defaultBudget, defaultTravelers, notes, applyPreferencesToForm]);

    return (
        <section className="rounded-3xl border border-slate-200/80 bg-white/85 p-6 shadow-lg shadow-slate-200/30 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/70">
            <header className="flex w-full items-start justify-between gap-3">
                <div className="flex flex-1 flex-col gap-1">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">旅行偏好档案</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        填写常去目的地、兴趣与预算，AI 生成行程前会自动纳入这些设定。
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleReset}
                    disabled={!hasChanges || isSaving}
                    className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:border-emerald-400 hover:text-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:border-emerald-500/70 dark:hover:text-emerald-200"
                >
                    <RefreshCcw className="mr-1 h-3.5 w-3.5" aria-hidden />
                    重置
                </button>
            </header>

            <div className="mt-5 grid gap-4">
                <label className="flex flex-col gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                    常去目的地（每行一个）
                    <textarea
                        value={frequentDestinations}
                        onChange={(event) => setFrequentDestinations(event.target.value)}
                        rows={3}
                        className="form-textarea"
                        placeholder={['日本 · 东京', '广东 · 潮州'].join('\n')}
                    />
                </label>

                <label className="flex flex-col gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                    兴趣偏好（用逗号或换行分隔）
                    <textarea
                        value={interests}
                        onChange={(event) => setInterests(event.target.value)}
                        rows={2}
                        className="form-textarea"
                        placeholder="美食, 徒步, 亲子"
                    />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                        常规预算（人民币）
                        <input
                            type="number"
                            min={0}
                            value={defaultBudget}
                            onChange={(event) => setDefaultBudget(event.target.value)}
                            className="form-input"
                            placeholder="12000"
                        />
                    </label>
                    <label className="flex flex-col gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                        常规同行人数
                        <input
                            type="number"
                            min={1}
                            value={defaultTravelers}
                            onChange={(event) => setDefaultTravelers(event.target.value)}
                            className="form-input"
                            placeholder="2"
                        />
                    </label>
                </div>

                <label className="flex flex-col gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                    其他备注
                    <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={3}
                        className="form-textarea"
                        placeholder="喜欢安静行程，避免过多购物安排。"
                    />
                </label>
            </div>

            {successMessage && (
                <div className="mt-4 rounded-2xl border border-emerald-400/60 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-700 dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-200">
                    {successMessage}
                </div>
            )}

            {errorMessage && (
                <div className="mt-4 rounded-2xl border border-rose-400/60 bg-rose-50/90 px-4 py-3 text-xs text-rose-700 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200">
                    {errorMessage}
                </div>
            )}

            <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                {isSaving ? '保存中...' : '保存偏好'}
            </button>
        </section>
    );
}

function parseListInput(input: string) {
    return input
        .split(/[\n,，]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .slice(0, 12);
}

function parsePositiveNumber(input: string) {
    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return Math.round(parsed);
}

function parsePositiveInteger(input: string) {
    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return Math.max(1, Math.round(parsed));
}

function listToTextarea(list?: string[] | null) {
    if (!list || list.length === 0) {
        return '';
    }

    return list.join('\n');
}

type RequestPayloadOptions = {
    frequentDestinations: string;
    interests: string;
    defaultBudget: string;
    defaultTravelers: string;
    notes: string;
};

function buildRequestPayload(options: RequestPayloadOptions) {
    const { frequentDestinations, interests, defaultBudget, defaultTravelers, notes } = options;

    return {
        frequentDestinations: parseListInput(frequentDestinations),
        interests: parseListInput(interests),
        defaultBudget: parsePositiveNumber(defaultBudget),
        defaultTravelers: parsePositiveInteger(defaultTravelers),
        notes: notes.trim() || null,
    };
}
