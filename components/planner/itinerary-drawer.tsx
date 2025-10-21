'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronRight, ListChecks, Loader2, X } from 'lucide-react';
import { ItineraryList } from '@/components/dashboard/itinerary-list';
import type { Database } from '@/lib/supabase/types';

type Itinerary = Database['public']['Tables']['itineraries']['Row'];

type PlannerItineraryDrawerProps = {
    itineraries: Itinerary[];
};

type ItineraryDetailResponse = {
    data: {
        id: string;
        destination: string;
        startDate: string;
        endDate: string;
        travelers: number;
        budget: number | null;
        preferences?: string | null;
        plan: unknown;
        rawPlan?: string | null;
    };
};

type PlannerShowItineraryEvent = {
    id: string;
    destination: string;
    startDate: string;
    endDate: string;
    travelers: number;
    budget: number | null;
    preferences?: string | null;
    plan: unknown;
    rawPlan?: string | null;
};

export function PlannerItineraryDrawer({ itineraries }: PlannerItineraryDrawerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const total = useMemo(() => itineraries.length, [itineraries]);

    const close = useCallback(() => {
        setIsOpen(false);
        setError(null);
    }, []);

    const handleSelect = useCallback(
        async (itinerary: Itinerary) => {
            if (!itinerary?.id) {
                return;
            }
            setLoadingId(itinerary.id);
            setError(null);
            try {
                const response = await fetch(`/api/itineraries/${itinerary.id}`);
                if (!response.ok) {
                    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                    throw new Error(payload?.error ?? '无法加载行程详情，请稍后再试。');
                }

                const payload = (await response.json()) as ItineraryDetailResponse;
                const detail = payload.data;
                const event: PlannerShowItineraryEvent = {
                    id: detail.id,
                    destination: detail.destination,
                    startDate: detail.startDate,
                    endDate: detail.endDate,
                    travelers: detail.travelers,
                    budget: detail.budget,
                    preferences: detail.preferences ?? null,
                    plan: detail.plan,
                    rawPlan: detail.rawPlan ?? null,
                };

                window.dispatchEvent(new CustomEvent('planner-show-itinerary', { detail: event }));
                setSelectedId(detail.id);
                const hasPlan = detail.plan && typeof detail.plan === 'object';
                if (hasPlan) {
                    setError(null);
                    setIsOpen(false);
                } else {
                    setError('该行程暂未保存完整的智能行程内容，请重新生成后再试。');
                }
            } catch (caught) {
                const message = caught instanceof Error ? caught.message : '无法加载行程详情，请稍后再试。';
                setError(message);
            } finally {
                setLoadingId(null);
            }
        },
        [],
    );

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="group fixed right-6 top-1/2 z-30 flex -translate-y-1/2 items-center gap-2 rounded-l-full border border-emerald-400/40 bg-emerald-500/90 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:translate-x-1 hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 dark:border-emerald-400/30 dark:bg-emerald-500/80"
            >
                <ListChecks className="h-4 w-4" aria-hidden />
                我的行程
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </button>

            <div
                className={`pointer-events-none fixed inset-0 z-40 transition ${isOpen ? 'pointer-events-auto visible opacity-100' : 'invisible opacity-0'
                    }`}
            >
                <div
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                    aria-hidden
                    onClick={close}
                />
                <aside
                    className={`absolute right-0 top-0 flex h-full w-full max-w-xl flex-col gap-4 border-l border-slate-200/70 bg-white p-6 shadow-2xl transition-transform duration-300 ease-in-out dark:border-slate-700/60 dark:bg-slate-900/95 ${isOpen ? 'translate-x-0' : 'translate-x-full'
                        }`}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="planner-itinerary-drawer-title"
                >
                    <header className="flex items-center justify-between gap-3 text-slate-700 dark:text-slate-200">
                        <div className="flex items-center gap-2">
                            <ListChecks className="h-5 w-5 text-emerald-500" aria-hidden />
                            <h2 id="planner-itinerary-drawer-title" className="text-lg font-semibold">
                                我的行程
                            </h2>
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">
                                {total}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={close}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-200"
                            aria-label="关闭行程列表"
                        >
                            <X className="h-4 w-4" aria-hidden />
                        </button>
                    </header>

                    {error && (
                        <p className="rounded-xl border border-rose-400/60 bg-rose-50/80 px-3 py-2 text-xs text-rose-600 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
                            {error}
                        </p>
                    )}

                    {loadingId && (
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/90 px-3 py-2 text-xs text-slate-500 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            正在加载行程详情…
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto pr-1">
                        <ItineraryList itineraries={itineraries} onSelect={handleSelect} selectedId={selectedId} />
                    </div>
                </aside>
            </div>
        </>
    );
}
