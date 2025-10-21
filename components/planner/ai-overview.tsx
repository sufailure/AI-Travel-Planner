'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { ItineraryMap } from '@/components/planner/itinerary-map';
import type { PlannerResult, PlannerBudgetEntry } from '@/lib/types/planner';
import {
    PLANNER_SAVE_REQUEST_EVENT,
    PLANNER_STATE_EVENT,
    type PlannerStateDetail,
} from '@/lib/types/planner-events';

const DEFAULT_STATE: PlannerStateDetail = {
    hasResult: false,
    result: null,
    rawPlan: null,
    isSaving: false,
    isSubmitting: false,
    saveMessage: null,
    saveError: null,
    saveButtonLabel: '保存至我的行程',
    saveButtonDisabled: true,
    saveButtonTitle: undefined,
    isExistingItinerary: false,
    isDirty: false,
    mapDestination: '',
};

export function PlannerAIOverview() {
    const [state, setState] = useState<PlannerStateDetail>(DEFAULT_STATE);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const handleUpdate = (event: Event) => {
            const detail = (event as CustomEvent<PlannerStateDetail>).detail;
            if (!detail) {
                return;
            }
            setState(detail);
        };

        window.addEventListener(PLANNER_STATE_EVENT, handleUpdate as EventListener);
        return () => {
            window.removeEventListener(PLANNER_STATE_EVENT, handleUpdate as EventListener);
        };
    }, []);

    const handleSaveClick = useCallback(() => {
        if (typeof window === 'undefined') {
            return;
        }
        window.dispatchEvent(new CustomEvent(PLANNER_SAVE_REQUEST_EVENT));
    }, []);

    const { hasResult, result } = state;

    const dailyPlanContent = useMemo(() => {
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
    }, [result]);

    const renderSection = useCallback((title: string, items: string[]) => {
        if (!items.length) {
            return null;
        }
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
    }, []);

    const budgetContent = useMemo(() => {
        if (!result?.estimatedBudget?.length) {
            return null;
        }

        const formatAmount = (entry: PlannerBudgetEntry) => {
            try {
                return entry.amount.toLocaleString('zh-CN', {
                    style: 'currency',
                    currency: entry.currency ?? 'CNY',
                });
            } catch (error) {
                return `${entry.amount}${entry.currency ?? 'CNY'}`;
            }
        };

        return (
            <div className="mt-4">
                <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">预算估算</h4>
                <ul className="mt-2 grid gap-2 text-sm">
                    {result.estimatedBudget.map((entry, index) => (
                        <li
                            key={`${entry.category}-${index}`}
                            className="rounded-xl bg-white/80 px-3 py-2 text-slate-700 shadow-sm dark:bg-slate-800/60 dark:text-slate-200"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-medium">{entry.category}</span>
                                <span>{formatAmount(entry)}</span>
                            </div>
                            {entry.notes && (
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.notes}</p>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        );
    }, [result]);

    if (!hasResult) {
        return (
            <section className="relative flex min-h-[32rem] flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border border-emerald-200/70 bg-white/95 p-8 text-center text-sm text-emerald-700/80 shadow-lg shadow-emerald-200/25 dark:border-emerald-500/40 dark:bg-slate-900/70 dark:text-emerald-200/80">
                <div className="pointer-events-none absolute -right-24 top-10 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-500/20" />
                <div className="pointer-events-none absolute -left-20 bottom-16 h-48 w-48 rounded-full bg-cyan-200/30 blur-3xl dark:bg-emerald-500/10" />
                <p className="text-base font-semibold">生成的行程将在这里展示</p>
                <p className="max-w-xs text-xs text-slate-600 dark:text-slate-400">
                    填写左侧表单或选择已有行程，即可即时查看地图、每日安排与预算分析。
                </p>
            </section>
        );
    }

    return (
        <section className="relative flex min-h-[32rem] flex-col overflow-hidden rounded-3xl border border-emerald-200/70 bg-white/95 p-6 text-slate-700 shadow-lg shadow-emerald-200/25 lg:p-8 dark:border-emerald-500/40 dark:bg-slate-900/70 dark:text-slate-200">
            <div className="pointer-events-none absolute -right-24 top-10 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-500/20" />
            <div className="pointer-events-none absolute -left-20 bottom-16 h-48 w-48 rounded-full bg-cyan-200/30 blur-3xl dark:bg-emerald-500/10" />

            {state.isSubmitting && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm dark:bg-slate-900/70">
                    <div className="flex items-center gap-2 rounded-full bg-emerald-500/90 px-4 py-2 text-xs font-medium text-white shadow-lg">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        AI 正在生成行程…
                    </div>
                </div>
            )}

            <div className="relative z-10 flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                    <h3 className="text-lg font-semibold text-emerald-700 dark:text-emerald-200">AI 行程概览</h3>
                    <button
                        type="button"
                        onClick={handleSaveClick}
                        disabled={state.saveButtonDisabled}
                        title={state.saveButtonTitle}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-500/70 disabled:text-white/80"
                    >
                        {state.isSaving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                保存中…
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" aria-hidden />
                                {state.saveButtonLabel}
                            </>
                        )}
                    </button>
                    {state.saveMessage && (
                        <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:bg-slate-900/50 dark:text-emerald-200">
                            {state.saveMessage}
                        </span>
                    )}
                    {state.saveError && (
                        <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-medium text-rose-600 dark:bg-slate-900/50 dark:text-rose-300">
                            {state.saveError}
                        </span>
                    )}
                </div>

                {result && (
                    <div className="space-y-4">
                        <ItineraryMap plan={result} destination={state.mapDestination} />
                        <p className="text-sm leading-relaxed">{result.overview}</p>
                        {renderSection('交通建议', result.transportation)}
                        {renderSection('住宿推荐', result.accommodations)}
                        {renderSection('餐饮推荐', result.restaurants)}
                        {budgetContent}
                        {renderSection('贴士', result.tips)}
                        {dailyPlanContent}
                    </div>
                )}
            </div>
        </section>
    );
}
