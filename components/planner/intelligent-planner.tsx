'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mic, MicOff, Sparkles } from 'lucide-react';
import { SPEECH_FALLBACK_MESSAGE, useSpeechRecorder } from '@/lib/client/use-speech-recorder';
import { ItineraryMap } from '@/components/planner/itinerary-map';
import type { PlannerResult, PlannerBudgetEntry } from '@/lib/types/planner';
import { sanitizeUserPreferences, type UserTravelPreferences } from '@/lib/types/preferences';

type GeneratePayload = {
    destination: string;
    startDate: string;
    endDate: string;
    travelers: number;
    budget: number | null;
    preferences: string;
};

type GenerateResponse = {
    plan: PlannerResult;
    raw: string;
};

type SaveItineraryResponse = {
    data?: {
        id: string;
        destination: string;
        start_date: string;
        end_date: string;
        travelers: number;
        budget: number | null;
    };
};

type PlannerShowItineraryDetail = {
    id: string;
    destination?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    travelers?: number | null;
    budget?: number | null;
    preferences?: string | null;
    plan?: unknown;
    rawPlan?: string | null;
};

type PlannerSnapshot = {
    destination: string;
    startDate: string;
    endDate: string;
    travelers: number;
    budget: string;
    preferences: string;
    planSignature: string | null;
    rawPlan: string | null;
};

function formatPreferenceText(preferences: UserTravelPreferences | null) {
    if (!preferences) {
        return '';
    }

    const parts: string[] = [];

    if (preferences.frequentDestinations?.length) {
        parts.push(`常去目的地：${preferences.frequentDestinations.join('、')}`);
    }

    if (preferences.interests?.length) {
        parts.push(`兴趣偏好：${preferences.interests.join('、')}`);
    }

    if (
        typeof preferences.defaultBudget === 'number' &&
        Number.isFinite(preferences.defaultBudget) &&
        preferences.defaultBudget > 0
    ) {
        parts.push(`常规预算：约 ${Math.round(preferences.defaultBudget)} 元`);
    }

    if (
        typeof preferences.defaultTravelers === 'number' &&
        Number.isFinite(preferences.defaultTravelers) &&
        preferences.defaultTravelers > 0
    ) {
        parts.push(`常规同行人数：${Math.max(1, Math.round(preferences.defaultTravelers))} 人`);
    }

    if (typeof preferences.notes === 'string' && preferences.notes.trim().length > 0) {
        parts.push(preferences.notes.trim());
    }

    return parts.join('\n');
}

type IntelligentPlannerProps = {
    initialPreferences: UserTravelPreferences | null;
};

function defaultTravelersFromPreferences(preferences: UserTravelPreferences | null) {
    const base = preferences?.defaultTravelers;
    if (typeof base === 'number' && Number.isFinite(base) && base > 0) {
        return Math.max(1, Math.round(base));
    }
    return 2;
}

function defaultBudgetFromPreferences(preferences: UserTravelPreferences | null) {
    const base = preferences?.defaultBudget;
    if (typeof base === 'number' && Number.isFinite(base) && base > 0) {
        return String(Math.round(base));
    }
    return '';
}

export function IntelligentPlanner({ initialPreferences }: IntelligentPlannerProps) {
    const router = useRouter();
    const sanitizedInitialPreferences = useMemo(
        () => sanitizeUserPreferences(initialPreferences),
        [initialPreferences],
    );
    const [preferenceSnapshot, setPreferenceSnapshot] = useState(sanitizedInitialPreferences);
    const autoPreferenceText = useRef(formatPreferenceText(sanitizedInitialPreferences));
    const [destination, setDestination] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [travelers, setTravelers] = useState(() => defaultTravelersFromPreferences(sanitizedInitialPreferences));
    const [budget, setBudget] = useState(() => defaultBudgetFromPreferences(sanitizedInitialPreferences));
    const [preferences, setPreferences] = useState(() => autoPreferenceText.current || '');
    const [formError, setFormError] = useState<string | null>(null);
    const [result, setResult] = useState<PlannerResult | null>(null);
    const [rawPlan, setRawPlan] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastUsedDetails, setLastUsedDetails] = useState<GeneratePayload | null>(null);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [activeItineraryId, setActiveItineraryId] = useState<string | null>(null);
    const [baselineSnapshot, setBaselineSnapshot] = useState<PlannerSnapshot | null>(null);

    const preferencesRef = useRef(preferences);
    const budgetRef = useRef(budget);
    const travelersRef = useRef(travelers);
    const autoBudgetRef = useRef(
        typeof sanitizedInitialPreferences?.defaultBudget === 'number' &&
            Number.isFinite(sanitizedInitialPreferences.defaultBudget) &&
            sanitizedInitialPreferences.defaultBudget > 0
            ? defaultBudgetFromPreferences(sanitizedInitialPreferences)
            : '',
    );
    const autoTravelersRef = useRef(
        typeof sanitizedInitialPreferences?.defaultTravelers === 'number' &&
            Number.isFinite(sanitizedInitialPreferences.defaultTravelers) &&
            sanitizedInitialPreferences.defaultTravelers > 0
            ? defaultTravelersFromPreferences(sanitizedInitialPreferences)
            : 0,
    );

    useEffect(() => {
        setPreferenceSnapshot(sanitizedInitialPreferences);
        autoPreferenceText.current = formatPreferenceText(sanitizedInitialPreferences);
    }, [sanitizedInitialPreferences]);

    useEffect(() => {
        preferencesRef.current = preferences;
    }, [preferences]);

    useEffect(() => {
        budgetRef.current = budget;
    }, [budget]);

    useEffect(() => {
        travelersRef.current = travelers;
    }, [travelers]);

    useEffect(() => {
        const listener = (event: Event) => {
            const detail = (event as CustomEvent<UserTravelPreferences | null>).detail;

            if (typeof detail === 'undefined') {
                return;
            }

            const sanitizedDetail = sanitizeUserPreferences(detail ?? null);
            setPreferenceSnapshot(sanitizedDetail);
            const previousAutoText = autoPreferenceText.current;
            const previousAutoBudget = autoBudgetRef.current;
            const previousAutoTravelers = autoTravelersRef.current;
            const nextText = formatPreferenceText(sanitizedDetail);

            autoPreferenceText.current = nextText;

            if (
                sanitizedDetail &&
                typeof sanitizedDetail.defaultTravelers === 'number' &&
                Number.isFinite(sanitizedDetail.defaultTravelers) &&
                sanitizedDetail.defaultTravelers > 0
            ) {
                const nextTravelers = Math.max(1, Math.round(sanitizedDetail.defaultTravelers));
                autoTravelersRef.current = nextTravelers;
                const shouldUpdateTravelers =
                    travelersRef.current === previousAutoTravelers ||
                    previousAutoTravelers === 0 ||
                    travelersRef.current <= 1;
                if (shouldUpdateTravelers) {
                    setTravelers(nextTravelers);
                }
            } else {
                autoTravelersRef.current = 0;
                if (travelersRef.current === previousAutoTravelers) {
                    setTravelers(2);
                }
            }

            if (
                sanitizedDetail &&
                typeof sanitizedDetail.defaultBudget === 'number' &&
                Number.isFinite(sanitizedDetail.defaultBudget) &&
                sanitizedDetail.defaultBudget > 0
            ) {
                const nextBudget = String(Math.round(sanitizedDetail.defaultBudget));
                autoBudgetRef.current = nextBudget;
                const shouldUpdateBudget =
                    budgetRef.current.trim().length === 0 || budgetRef.current === previousAutoBudget;
                if (shouldUpdateBudget) {
                    setBudget(nextBudget);
                }
            } else {
                autoBudgetRef.current = '';
                if (budgetRef.current === previousAutoBudget) {
                    setBudget('');
                }
            }

            const shouldReplacePreferences =
                preferencesRef.current.trim().length === 0 ||
                preferencesRef.current.trim() === previousAutoText.trim();

            if (shouldReplacePreferences) {
                setPreferences(nextText);
            }
        };

        window.addEventListener('user-preferences-updated', listener as EventListener);

        return () => {
            window.removeEventListener('user-preferences-updated', listener as EventListener);
        };
    }, []);

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<PlannerShowItineraryDetail>).detail;
            if (!detail) {
                return;
            }

            setIsSubmitting(false);
            setIsSaving(false);
            setSaveMessage(null);
            setSaveError(null);
            setFormError(null);

            const destinationValue = typeof detail.destination === 'string' ? detail.destination.trim() : '';
            setDestination(destinationValue);

            const startValue = typeof detail.startDate === 'string' ? detail.startDate : '';
            const endValue = typeof detail.endDate === 'string' ? detail.endDate : '';
            setStartDate(startValue);
            setEndDate(endValue);

            const travelerCount =
                typeof detail.travelers === 'number' && Number.isFinite(detail.travelers) && detail.travelers > 0
                    ? Math.max(1, Math.round(detail.travelers))
                    : Math.max(1, travelersRef.current);
            setTravelers(travelerCount);

            const budgetValue =
                typeof detail.budget === 'number' && Number.isFinite(detail.budget)
                    ? String(detail.budget)
                    : '';
            setBudget(budgetValue);

            const preferenceValue =
                typeof detail.preferences === 'string' && detail.preferences.trim().length > 0
                    ? detail.preferences.trim()
                    : '';
            setPreferences(preferenceValue);

            const loadedPlan = detail.plan && isPlannerResult(detail.plan) ? detail.plan : null;
            setResult(loadedPlan);
            const loadedRawPlan = typeof detail.rawPlan === 'string' ? detail.rawPlan : null;
            setRawPlan(loadedRawPlan);

            const snapshot = createSnapshot({
                destination: destinationValue,
                startDate: startValue,
                endDate: endValue,
                travelers: travelerCount,
                budget: budgetValue,
                preferences: preferenceValue,
                plan: loadedPlan,
                rawPlan: loadedRawPlan,
            });

            setBaselineSnapshot(snapshot);
            setActiveItineraryId(detail.id);

            setLastUsedDetails({
                destination: destinationValue,
                startDate: startValue,
                endDate: endValue,
                travelers: travelerCount,
                budget:
                    typeof detail.budget === 'number' && Number.isFinite(detail.budget) ? detail.budget : null,
                preferences: preferenceValue,
            });
        };

        window.addEventListener('planner-show-itinerary', handler as EventListener);
        return () => {
            window.removeEventListener('planner-show-itinerary', handler as EventListener);
        };
    }, []);

    const destinationSuggestions = useMemo(
        () => preferenceSnapshot?.frequentDestinations ?? [],
        [preferenceSnapshot],
    );
    const interestSuggestions = useMemo(
        () => preferenceSnapshot?.interests ?? [],
        [preferenceSnapshot],
    );
    const hasDestinationSuggestions = destinationSuggestions.length > 0;
    const hasInterestSuggestions = interestSuggestions.length > 0;

    const handleApplyDestination = useCallback(
        (value: string) => {
            const normalized = value.trim();
            if (!normalized) {
                return;
            }
            setDestination(normalized);
            setFormError(null);
        },
        [setFormError],
    );

    const handleApplyInterest = useCallback(
        (value: string) => {
            const token = value.trim();
            if (!token) {
                return;
            }

            setPreferences((current: string) => {
                const normalized = current.trim();
                const existing = normalized
                    ? normalized
                        .split(/[\n,，]/)
                        .map((segment) => segment.trim())
                        .filter(Boolean)
                    : [];

                if (existing.includes(token)) {
                    return current;
                }

                return normalized ? `${normalized}\n${token}` : token;
            });
            setFormError(null);
        },
        [setFormError],
    );

    const logVoiceTranscript = useCallback((text: string) => {
        if (!text.trim()) {
            return;
        }

        const payload = parseTripDetails(text);
        fetch('/api/voice-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript: text, intent: 'planner-input', payload }),
        }).catch(() => undefined);
    }, []);

    const applyParsedDetails = useCallback(
        (source: string) => {
            const parsed = parseTripDetails(source);

            if (parsed.destination && destination.trim().length === 0) {
                setDestination(parsed.destination);
            }
            if (parsed.budget != null && budget.trim().length === 0) {
                setBudget(String(parsed.budget));
            }
            if (parsed.travelers != null && (travelers <= 1 || travelers === 2)) {
                setTravelers(Math.max(parsed.travelers, 1));
            }
            if (parsed.startDate && !startDate) {
                setStartDate(parsed.startDate);
            }
            if (parsed.endDate && !endDate) {
                setEndDate(parsed.endDate);
            }
        },
        [destination, budget, travelers, startDate, endDate],
    );

    const handleTranscript = useCallback(
        (text: string) => {
            setPreferences((current: string) => (current ? `${current.trim()}
${text}` : text));
            applyParsedDetails(text);
            logVoiceTranscript(text);
        },
        [applyParsedDetails, logVoiceTranscript],
    );

    const currentSnapshot = useMemo(
        () =>
            createSnapshot({
                destination,
                startDate,
                endDate,
                travelers,
                budget,
                preferences,
                plan: result,
                rawPlan,
            }),
        [destination, startDate, endDate, travelers, budget, preferences, result, rawPlan],
    );

    const hasResult = Boolean(result);
    const isExistingItinerary = Boolean(activeItineraryId);

    const isDirty = useMemo(() => {
        if (!hasResult) {
            return false;
        }

        if (!isExistingItinerary) {
            return true;
        }

        if (!baselineSnapshot) {
            return true;
        }

        return !snapshotEquals(baselineSnapshot, currentSnapshot);
    }, [baselineSnapshot, currentSnapshot, hasResult, isExistingItinerary]);

    useEffect(() => {
        if (isDirty) {
            setSaveMessage(null);
        }

        if (!isDirty && isExistingItinerary) {
            setSaveError(null);
        }
    }, [isDirty, isExistingItinerary]);

    const saveButtonLabel = isExistingItinerary
        ? isDirty
            ? '更新我的行程'
            : '已同步'
        : '保存至我的行程';
    const saveButtonDisabled = !hasResult || isSaving || (isExistingItinerary && !isDirty);
    const saveButtonTitle = isExistingItinerary && !isDirty ? '当前行程未发生改动，无需保存。' : undefined;

    const {
        supportsSpeech,
        isListening,
        isProcessing: isTranscribing,
        error: speechError,
        toggleRecording,
        clearError: clearSpeechError,
    } = useSpeechRecorder({
        onTranscript: handleTranscript,
    });

    const handleToggleListening = useCallback(() => {
        if (!isListening) {
            clearSpeechError();
            setFormError(null);
        }
        void toggleRecording();
    }, [clearSpeechError, isListening, toggleRecording]);

    const errorMessages = useMemo(() => {
        return [speechError, formError].filter((message): message is string => Boolean(message));
    }, [speechError, formError]);

    const mapDestination = useMemo(() => {
        const manual = destination.trim();
        if (manual) {
            return manual;
        }
        const fromPayload = (lastUsedDetails?.destination ?? '').trim();
        return fromPayload;
    }, [destination, lastUsedDetails]);

    const canSubmit = useMemo(() => {
        return destination.trim().length > 0 || preferences.trim().length > 0;
    }, [destination, preferences]);

    const handleSubmit = useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (!canSubmit) {
                setFormError('请至少提供目的地或语音描述。');
                return;
            }

            setSaveMessage(null);
            setSaveError(null);

            const parsedFromPreferences = preferences.trim().length > 0 ? parseTripDetails(preferences) : {};
            const finalDestination = destination.trim() || parsedFromPreferences.destination || '';
            const finalBudget = budget ? Number(budget) : parsedFromPreferences.budget ?? null;
            const finalTravelers = travelers > 0 ? travelers : parsedFromPreferences.travelers ?? 1;
            const finalStartDate = startDate || parsedFromPreferences.startDate || '';
            const finalEndDate = endDate || parsedFromPreferences.endDate || '';

            if (!destination.trim() && parsedFromPreferences.destination) {
                setDestination(parsedFromPreferences.destination);
            }
            if (!budget && parsedFromPreferences.budget != null) {
                setBudget(String(parsedFromPreferences.budget));
            }
            if ((travelers <= 1 || travelers === 2) && parsedFromPreferences.travelers != null) {
                setTravelers(Math.max(parsedFromPreferences.travelers, 1));
            }
            if (!startDate && parsedFromPreferences.startDate) {
                setStartDate(parsedFromPreferences.startDate);
            }
            if (!endDate && parsedFromPreferences.endDate) {
                setEndDate(parsedFromPreferences.endDate);
            }

            const payload: GeneratePayload = {
                destination: finalDestination,
                startDate: finalStartDate,
                endDate: finalEndDate,
                travelers: finalTravelers,
                budget: finalBudget,
                preferences,
            };

            setLastUsedDetails(payload);

            setIsSubmitting(true);
            clearSpeechError();
            setFormError(null);
            setResult(null);
            setRawPlan(null);
            setSaveMessage(null);
            setSaveError(null);

            try {
                const response = await fetch('/api/itineraries/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    setFormError((data as { error?: string }).error ?? '生成行程失败，请稍后重试。');
                    return;
                }

                const data = (await response.json()) as GenerateResponse;
                setResult(data.plan);
                setRawPlan(data.raw);
            } catch (err) {
                console.error('Generate itinerary failed', err);
                setFormError('生成行程失败，请检查网络连接。');
            } finally {
                setIsSubmitting(false);
            }
        },
        [canSubmit, destination, startDate, endDate, travelers, budget, preferences, clearSpeechError],
    );

    const handleSavePlan = useCallback(async () => {
        if (!result) {
            return;
        }

        if (isExistingItinerary && !isDirty) {
            setSaveMessage('当前行程已是最新状态。');
            return;
        }

        const parsedFallback = preferences.trim().length > 0 ? parseTripDetails(preferences) : {};
        const destinationLabel =
            destination.trim() || lastUsedDetails?.destination || parsedFallback.destination || '智能行程';

        const dailySpan = Math.max(result.dailyPlan.length, 1);
        const startCandidate = lastUsedDetails?.startDate || startDate || parsedFallback.startDate || '';
        let finalStart = ensureIsoDate(startCandidate);
        if (!finalStart) {
            finalStart = formatDateToIso(new Date());
        }

        const endCandidate = lastUsedDetails?.endDate || endDate || parsedFallback.endDate || '';
        let finalEnd = ensureIsoDate(endCandidate);
        if (!finalEnd && finalStart) {
            finalEnd = addDays(finalStart, dailySpan - 1);
        }

        if (!finalStart || !finalEnd) {
            setSaveError('请补充完整的旅行日期后再保存。');
            return;
        }

        if (new Date(finalEnd).getTime() < new Date(finalStart).getTime()) {
            setSaveError('结束日期需要晚于开始日期。');
            return;
        }

        const travelerCandidate = lastUsedDetails?.travelers ?? travelers;
        const safeTravelers =
            Number.isFinite(travelerCandidate) && travelerCandidate > 0
                ? Math.round(travelerCandidate)
                : 1;

        const providedBudget = budget ? Number(budget) : lastUsedDetails?.budget ?? null;
        const normalizedBudget =
            typeof providedBudget === 'number' && Number.isFinite(providedBudget) && providedBudget > 0
                ? providedBudget
                : null;
        const planBudget = sumEstimatedBudget(result.estimatedBudget);
        const finalBudget = normalizedBudget ?? (planBudget > 0 ? planBudget : null);
        const trimmedPreferences = preferences.trim();

        const payload = {
            title: `${destinationLabel} · 智能行程`,
            destination: destinationLabel,
            startDate: finalStart,
            endDate: finalEnd,
            travelers: safeTravelers,
            budget: finalBudget,
            preferences: trimmedPreferences,
            plan: result,
            rawPlan,
        };

        const isUpdate = isExistingItinerary && typeof activeItineraryId === 'string';
        const endpoint = isUpdate ? `/api/itineraries/${activeItineraryId}` : '/api/itineraries';
        const method = isUpdate ? 'PATCH' : 'POST';

        setIsSaving(true);
        setSaveError(null);
        setSaveMessage(null);

        try {
            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
                throw new Error(errorPayload?.error ?? '行程保存失败，请稍后再试。');
            }

            const responseBody = (await response.json()) as SaveItineraryResponse;
            const saved = responseBody.data;

            if (!saved) {
                throw new Error('行程保存成功，但未返回最新数据。');
            }

            setActiveItineraryId(saved.id);

            const nextSnapshot = createSnapshot({
                destination: payload.destination,
                startDate: payload.startDate,
                endDate: payload.endDate,
                travelers: payload.travelers,
                budget: payload.budget,
                preferences: trimmedPreferences,
                plan: result,
                rawPlan,
            });

            setBaselineSnapshot(nextSnapshot);
            setBudget(nextSnapshot.budget);
            setPreferences(nextSnapshot.preferences);
            setLastUsedDetails({
                destination: payload.destination,
                startDate: payload.startDate,
                endDate: payload.endDate,
                travelers: payload.travelers,
                budget: payload.budget,
                preferences: trimmedPreferences,
            });
            setSaveError(null);
            setSaveMessage(isUpdate ? '修改已保存并覆盖原行程。' : '行程已保存并同步到云端。');
            router.refresh();
        } catch (error) {
            const message = error instanceof Error ? error.message : '行程保存失败，请稍后再试。';
            setSaveError(message);
        } finally {
            setIsSaving(false);
        }
    }, [
        result,
        isExistingItinerary,
        isDirty,
        preferences,
        destination,
        lastUsedDetails,
        startDate,
        endDate,
        budget,
        travelers,
        rawPlan,
        activeItineraryId,
        router,
    ]);

    const renderDailyPlan = () => {
        if (!result?.dailyPlan?.length) {
            return null;
        }

        return (
            <div className="mt-6 overflow-x-auto pb-2">
                <div className="flex min-w-max gap-4 snap-x snap-mandatory">
                    {result.dailyPlan.map((day, index) => (
                        <div
                            key={`${day.title}-${index}`}
                            className="flex w-72 shrink-0 snap-start flex-col rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm transition hover:shadow-md dark:border-slate-700/60 dark:bg-slate-900/60"
                        >
                            <div className="flex flex-col gap-2">
                                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                    {day.title}
                                </h4>
                                {day.summary && (
                                    <p className="text-sm text-slate-600 dark:text-slate-300">{day.summary}</p>
                                )}
                            </div>
                            {day.activities.length > 0 && (
                                <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                    {day.activities.map((activity, activityIndex) => (
                                        <li key={`${activity}-${activityIndex}`} className="flex items-start gap-2">
                                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                                            <span>{activity}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {day.meals.length > 0 && (
                                <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                                    <p className="font-medium text-emerald-600 dark:text-emerald-300">餐饮建议</p>
                                    <ul className="mt-1 space-y-1">
                                        {day.meals.map((meal, mealIndex) => (
                                            <li key={`${meal}-${mealIndex}`}>{meal}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-lg shadow-emerald-200/20 transition dark:border-slate-700/60 dark:bg-slate-900/60 dark:shadow-emerald-500/10">
            <div className="pointer-events-none absolute -top-20 right-0 h-52 w-52 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/20" />
            <header className="relative flex flex-col gap-3">
                <div className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                    <Sparkles className="h-4 w-4" aria-hidden />
                    智能行程规划（语音支持）
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    输入你的旅行计划，让 AI 生成交通、住宿与景点安排
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    支持语音描述，例如：“我想去日本东京，5 天，预算 1 万元，喜欢美食和动漫，带孩子”。
                </p>
            </header>

            <div className="relative mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
                <div className="flex w-full flex-col lg:sticky lg:top-24 lg:max-w-xs xl:max-w-sm">
                    <form onSubmit={handleSubmit} className="grid gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                                目的地
                                <input
                                    type="text"
                                    value={destination}
                                    onChange={(event) => setDestination(event.target.value)}
                                    placeholder="日本 · 东京"
                                    className="form-input"
                                />
                            </label>
                            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                                预算（人民币）
                                <input
                                    type="number"
                                    min={0}
                                    value={budget}
                                    onChange={(event) => setBudget(event.target.value)}
                                    placeholder="10000"
                                    className="form-input"
                                />
                            </label>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                                出发日期
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(event) => setStartDate(event.target.value)}
                                    className="form-input"
                                />
                            </label>
                            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                                结束日期
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(event) => setEndDate(event.target.value)}
                                    className="form-input"
                                />
                            </label>
                        </div>

                        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                            同行人数
                            <input
                                type="number"
                                min={1}
                                value={travelers}
                                onChange={(event) => setTravelers(Number(event.target.value) || 1)}
                                className="form-input"
                            />
                        </label>

                        <div className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                            旅行偏好 / 语音描述
                            <div className="flex flex-col gap-3">
                                <textarea
                                    value={preferences}
                                    onChange={(event) => setPreferences(event.target.value)}
                                    placeholder="喜欢美食、动漫体验，需要亲子友好。"
                                    rows={4}
                                    className="form-input resize-none"
                                />
                                {(hasDestinationSuggestions || hasInterestSuggestions) && (
                                    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3 text-xs text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-300">
                                        {hasDestinationSuggestions && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium text-slate-500 dark:text-slate-400">常用目的地：</span>
                                                {destinationSuggestions.map((item) => (
                                                    <button
                                                        key={`destination-${item}`}
                                                        type="button"
                                                        onClick={() => handleApplyDestination(item)}
                                                        className="rounded-full border border-emerald-300/60 px-3 py-1 text-[11px] font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                                                    >
                                                        {item}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {hasInterestSuggestions && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium text-slate-500 dark:text-slate-400">偏好标签：</span>
                                                {interestSuggestions.map((item) => (
                                                    <button
                                                        key={`interest-${item}`}
                                                        type="button"
                                                        onClick={() => handleApplyInterest(item)}
                                                        className="rounded-full border border-slate-300/70 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-emerald-400 hover:text-emerald-500 dark:border-slate-600 dark:text-slate-300 dark:hover:border-emerald-500/70 dark:hover:text-emerald-200"
                                                    >
                                                        {item}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={handleToggleListening}
                                    disabled={isSubmitting || isTranscribing}
                                    className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-emerald-400 hover:text-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:border-emerald-400/70 dark:hover:text-emerald-300"
                                >
                                    {isTranscribing ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                            识别中…
                                        </>
                                    ) : isListening ? (
                                        <>
                                            <MicOff className="h-4 w-4" aria-hidden />
                                            停止录音
                                        </>
                                    ) : (
                                        <>
                                            <Mic className="h-4 w-4" aria-hidden />
                                            语音输入
                                        </>
                                    )}
                                </button>
                                {!supportsSpeech && (
                                    <p className="text-xs text-amber-600 dark:text-amber-300">
                                        {SPEECH_FALLBACK_MESSAGE}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm">
                            <button
                                type="submit"
                                disabled={isSubmitting || !canSubmit}
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:from-emerald-400 hover:via-emerald-300 hover:to-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                        生成中…
                                    </>
                                ) : (
                                    '生成智能行程'
                                )}
                            </button>
                        </div>

                        {errorMessages.length > 0 && (
                            <div className="space-y-1 rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-2 text-sm text-amber-700 dark:border-amber-400/60 dark:bg-amber-500/10 dark:text-amber-200">
                                {errorMessages.map((message, index) => (
                                    <p key={`${message}-${index}`}>{message}</p>
                                ))}
                            </div>
                        )}
                    </form>
                </div>
                <div className="relative flex min-h-[32rem] flex-1 flex-col overflow-hidden rounded-3xl border border-emerald-200/70 bg-white/95 p-6 text-slate-700 shadow-lg shadow-emerald-200/25 lg:p-8 dark:border-emerald-500/40 dark:bg-slate-900/70 dark:text-slate-200">
                    <div className="pointer-events-none absolute -right-24 top-10 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-500/20" />
                    <div className="pointer-events-none absolute -left-20 bottom-16 h-48 w-48 rounded-full bg-cyan-200/30 blur-3xl dark:bg-emerald-500/10" />
                    {result ? (
                        <div className="relative z-10 flex h-full flex-col gap-5">
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                                <h3 className="text-lg font-semibold text-emerald-700 dark:text-emerald-200">AI 行程概览</h3>
                                <button
                                    type="button"
                                    onClick={handleSavePlan}
                                    disabled={saveButtonDisabled}
                                    title={saveButtonTitle}
                                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-500/70 disabled:text-white/80"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                            保存中…
                                        </>
                                    ) : (
                                        saveButtonLabel
                                    )}
                                </button>
                                {saveMessage && (
                                    <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:bg-slate-900/50 dark:text-emerald-200">
                                        {saveMessage}
                                    </span>
                                )}
                                {saveError && (
                                    <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-medium text-rose-600 dark:bg-slate-900/50 dark:text-rose-300">
                                        {saveError}
                                    </span>
                                )}
                            </div>

                            <div className="space-y-4">
                                <ItineraryMap plan={result} destination={mapDestination} />
                                <p className="text-sm leading-relaxed">{result.overview}</p>

                                {result.transportation.length > 0 && (
                                    <SectionList title="交通建议" items={result.transportation} />
                                )}
                                {result.accommodations.length > 0 && (
                                    <SectionList title="住宿推荐" items={result.accommodations} />
                                )}
                                {result.restaurants.length > 0 && (
                                    <SectionList title="餐饮推荐" items={result.restaurants} />
                                )}

                                {result.estimatedBudget.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">预算估算</h4>
                                        <ul className="mt-2 grid gap-2 text-sm">
                                            {result.estimatedBudget.map((entry, index) => (
                                                <li key={`${entry.category}-${index}`} className="rounded-xl bg-white/80 px-3 py-2 text-slate-700 shadow-sm dark:bg-slate-800/60 dark:text-slate-200">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <span className="font-medium">{entry.category}</span>
                                                        <span>
                                                            {entry.amount.toLocaleString('zh-CN', {
                                                                style: 'currency',
                                                                currency: entry.currency ?? 'CNY',
                                                            })}
                                                        </span>
                                                    </div>
                                                    {entry.notes && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.notes}</p>}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {result.tips.length > 0 && <SectionList title="贴士" items={result.tips} />}
                                {renderDailyPlan()}
                            </div>
                        </div>
                    ) : (
                        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-emerald-700/80 dark:text-emerald-200/80">
                            <p className="text-base font-semibold">生成的行程将在这里展示</p>
                            <p className="max-w-xs text-xs text-slate-600 dark:text-slate-400">
                                填写左侧表单或选择已有行程，即可即时查看地图、每日安排与预算分析。
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

type SectionListProps = {
    title: string;
    items: string[];
};

function isPlannerResult(candidate: unknown): candidate is PlannerResult {
    if (!candidate || typeof candidate !== 'object') {
        return false;
    }

    const plan = candidate as PlannerResult;
    const isStringArray = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === 'string');

    if (typeof plan.overview !== 'string') {
        return false;
    }

    if (!Array.isArray(plan.dailyPlan)) {
        return false;
    }

    const validDays = plan.dailyPlan.every(
        (day) =>
            day &&
            typeof day === 'object' &&
            typeof day.title === 'string' &&
            typeof day.summary === 'string' &&
            isStringArray(day.activities) &&
            isStringArray(day.meals),
    );

    if (!validDays) {
        return false;
    }

    if (!isStringArray(plan.transportation) || !isStringArray(plan.accommodations) || !isStringArray(plan.restaurants)) {
        return false;
    }

    if (!Array.isArray(plan.estimatedBudget)) {
        return false;
    }

    const validBudget = plan.estimatedBudget.every(
        (entry) =>
            entry &&
            typeof entry === 'object' &&
            typeof entry.category === 'string' &&
            typeof entry.amount === 'number' &&
            typeof entry.currency === 'string',
    );

    if (!validBudget) {
        return false;
    }

    if (!isStringArray(plan.tips)) {
        return false;
    }

    return true;
}

function SectionList({ title, items }: SectionListProps) {
    return (
        <div className="mt-6">
            <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">{title}</h4>
            <ul className="mt-2 space-y-1 text-sm">
                {items.map((item, index) => (
                    <li key={`${title}-${index}`} className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function createSnapshot({
    destination,
    startDate,
    endDate,
    travelers,
    budget,
    preferences,
    plan,
    rawPlan,
}: {
    destination?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    travelers?: number | null;
    budget?: string | number | null;
    preferences?: string | null;
    plan: PlannerResult | null;
    rawPlan?: string | null;
}): PlannerSnapshot {
    const normalizedBudget =
        typeof budget === 'number'
            ? Number.isFinite(budget)
                ? String(budget)
                : ''
            : typeof budget === 'string'
                ? budget.trim()
                : '';

    const normalizedRawPlan =
        typeof rawPlan === 'string' && rawPlan.trim().length > 0 ? rawPlan : null;

    return {
        destination: typeof destination === 'string' ? destination.trim() : '',
        startDate: typeof startDate === 'string' ? startDate : '',
        endDate: typeof endDate === 'string' ? endDate : '',
        travelers:
            typeof travelers === 'number' && Number.isFinite(travelers) && travelers > 0
                ? Math.round(travelers)
                : 1,
        budget: normalizedBudget,
        preferences: typeof preferences === 'string' ? preferences.trim() : '',
        planSignature: planSignatureOf(plan),
        rawPlan: normalizedRawPlan,
    };
}

function snapshotEquals(first: PlannerSnapshot | null, second: PlannerSnapshot | null) {
    if (!first || !second) {
        return false;
    }
    return (
        first.destination === second.destination &&
        first.startDate === second.startDate &&
        first.endDate === second.endDate &&
        first.travelers === second.travelers &&
        first.budget === second.budget &&
        first.preferences === second.preferences &&
        first.planSignature === second.planSignature &&
        first.rawPlan === second.rawPlan
    );
}

function planSignatureOf(plan: PlannerResult | null) {
    if (!plan) {
        return null;
    }
    try {
        return JSON.stringify(plan);
    } catch (_error) {
        return `${Date.now()}`;
    }
}

type ParsedTripDetails = {
    destination?: string;
    budget?: number;
    travelers?: number;
    startDate?: string;
    endDate?: string;
};

function ensureIsoDate(value?: string | null) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return formatDateToIso(date);
}

function formatDateToIso(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDays(isoDate: string, days: number) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
        return isoDate;
    }

    date.setDate(date.getDate() + days);
    return formatDateToIso(date);
}

function sumEstimatedBudget(entries: PlannerBudgetEntry[]) {
    return entries.reduce((total, entry) => {
        const amount = typeof entry.amount === 'number' ? entry.amount : Number(entry.amount ?? 0);
        return Number.isFinite(amount) ? total + amount : total;
    }, 0);
}

function parseTripDetails(input: string): ParsedTripDetails {
    if (!input) {
        return {};
    }

    const text = input.replace(/\s+/g, ' ').trim();
    if (!text) {
        return {};
    }

    const result: ParsedTripDetails = {};

    const destination = extractDestination(text);
    if (destination) {
        result.destination = destination;
    }

    const budget = extractBudget(text);
    if (budget != null) {
        result.budget = budget;
    }

    const travelers = extractTravelers(text);
    if (travelers != null) {
        result.travelers = travelers;
    }

    const dates = extractDates(text);
    if (dates.start) {
        result.startDate = dates.start;
    }
    if (dates.end) {
        result.endDate = dates.end;
    }

    return result;
}

function extractDestination(text: string) {
    const patterns = [
        /(?:想去|准备去|计划去|打算去|要去|去|到)([^0-9，。,！？!?]{2,20})/i,
        /目的地(?:是|为)?([^\s，。,！？!?]{2,20})/i,
    ];

    for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match?.[1]) {
            const segment = match[1].split(/[，,。；;！!？?、]/)[0] ?? '';
            const cleaned = segment
                .replace(/(旅行|旅游|玩|看看|一下|附近|那边|这里|那里|城市|地方)$/u, '')
                .trim();
            if (cleaned) {
                return cleaned;
            }
        }
    }

    return null;
}

function extractBudget(text: string) {
    const match = /预算(?:大约|大概|大概在|大概是|约)?\s*([0-9一二三四五六七八九十百千万两\.]+)\s*(万|千|百|十)?\s*(?:元|块|人民币|rmb)?/i.exec(
        text,
    );
    if (!match) {
        return null;
    }

    const base = parseNumberToken(match[1]);
    if (base == null) {
        return null;
    }

    const unit = match[2];
    const multiplier = unit === '万' ? 10000 : unit === '千' ? 1000 : unit === '百' ? 100 : unit === '十' ? 10 : 1;
    return Math.round(base * multiplier);
}

function extractTravelers(text: string) {
    const match = /([0-9一二三四五六七八九十百千万两]+)\s*(?:位|人)(?:同行|出行|一起|参加)?/.exec(text);
    if (match?.[1]) {
        const parsed = parseNumberToken(match[1]);
        if (parsed != null && parsed > 0) {
            return Math.max(1, Math.floor(parsed));
        }
    }

    if (/一家三口/.test(text)) {
        return 3;
    }
    if (/一家四口/.test(text)) {
        return 4;
    }
    if (/情侣|夫妻|二人世界/.test(text)) {
        return 2;
    }
    if (/带孩子|亲子/.test(text)) {
        return 3;
    }

    return null;
}

function extractDates(text: string) {
    const result: { start?: string; end?: string } = {};

    const isoMatches = [...text.matchAll(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/g)];
    if (isoMatches.length > 0) {
        const [y1, m1, d1] = isoMatches[0].slice(1).map((value) => Number(value));
        result.start = formatIsoDate(y1, m1, d1);
        if (isoMatches.length > 1) {
            const [y2, m2, d2] = isoMatches[1].slice(1).map((value) => Number(value));
            result.end = formatIsoDate(y2, m2, d2);
            return result;
        }
    }

    const monthDayMatches = [...text.matchAll(/(\d{1,2})月(\d{1,2})日?/g)];
    if (monthDayMatches.length > 0 && !result.start) {
        const currentYear = new Date().getFullYear();
        const [m1, d1] = monthDayMatches[0].slice(1).map((value) => Number(value));
        result.start = formatIsoDate(currentYear, m1, d1);
        if (monthDayMatches.length > 1) {
            const [m2, d2] = monthDayMatches[1].slice(1).map((value) => Number(value));
            result.end = formatIsoDate(currentYear, m2, d2);
        }
    }

    if (!result.end && result.start) {
        const durationMatch = text.match(/(\d+)\s*(?:天|日)/);
        if (durationMatch) {
            const days = Number(durationMatch[1]);
            if (!Number.isNaN(days) && days > 0) {
                const startTime = new Date(result.start);
                if (!Number.isNaN(startTime.getTime())) {
                    const endTime = new Date(startTime);
                    endTime.setDate(startTime.getDate() + days - 1);
                    result.end = formatIsoDate(
                        endTime.getFullYear(),
                        endTime.getMonth() + 1,
                        endTime.getDate(),
                    );
                }
            }
        }
    }

    return result;
}

function parseNumberToken(value: string) {
    if (!value) {
        return null;
    }

    const sanitized = value.replace(/[\s,]/g, '');
    if (!sanitized) {
        return null;
    }

    const direct = Number(sanitized);
    if (!Number.isNaN(direct)) {
        return direct;
    }

    return chineseToNumber(sanitized);
}

function chineseToNumber(value: string) {
    const digitMap: Record<string, number> = {
        零: 0,
        一: 1,
        二: 2,
        两: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        七: 7,
        八: 8,
        九: 9,
    };
    const unitMap: Record<string, number> = {
        十: 10,
        百: 100,
        千: 1000,
        万: 10000,
    };

    let result = 0;
    let section = 0;
    let number = 0;

    for (const char of value) {
        if (char in digitMap) {
            number = digitMap[char];
        } else if (char in unitMap) {
            const unit = unitMap[char];
            if (unit === 10000) {
                section = (section + number) * unit;
                result += section;
                section = 0;
            } else {
                section += (number || 1) * unit;
            }
            number = 0;
        }
    }

    return result + section + number;
}

function formatIsoDate(year?: number, month?: number, day?: number) {
    if (!year || !month || !day) {
        return '';
    }

    const m = month.toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    return `${year}-${m}-${d}`;
}
