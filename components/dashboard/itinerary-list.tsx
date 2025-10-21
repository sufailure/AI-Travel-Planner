'use client';

import { useMemo, useState, useTransition } from 'react';
import type { MouseEvent, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarRange, MapPin, Trash2, Users, Wallet2 } from 'lucide-react';
import type { Database } from '@/lib/supabase/types';

type Itinerary = Database['public']['Tables']['itineraries']['Row'];

type ItineraryListProps = {
    itineraries: Itinerary[];
    onSelect?: (itinerary: Itinerary) => void | Promise<void>;
    selectedId?: string | null;
};

type PendingDeletion = {
    id: string;
    title: string;
};

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
});

const emptyState = {
    title: '暂无行程',
    description: '使用智能规划器创建你的第一份旅行计划，AI 将根据你的偏好推荐交通、酒店与活动。',
    footer: '创建设备同步、费用追踪与语音助手功能将在后续版本陆续开放，敬请期待。',
};

export function ItineraryList({ itineraries, onSelect, selectedId }: ItineraryListProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const sortedItineraries = useMemo(() => {
        return [...itineraries].sort((first, second) => {
            const a = first.start_date ? new Date(first.start_date).getTime() : Number.MAX_SAFE_INTEGER;
            const b = second.start_date ? new Date(second.start_date).getTime() : Number.MAX_SAFE_INTEGER;
            return a - b;
        });
    }, [itineraries]);

    if (!sortedItineraries.length) {
        return (
            <div className="flex h-full flex-col justify-between gap-6 rounded-3xl border border-dashed border-emerald-500/30 bg-white/80 p-8 text-slate-600 shadow-sm backdrop-blur dark:border-emerald-500/40 dark:bg-slate-900/60 dark:text-slate-200">
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{emptyState.title}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{emptyState.description}</p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-500">{emptyState.footer}</p>
            </div>
        );
    }

    const handleDelete = (event: MouseEvent<HTMLButtonElement>, itinerary: Itinerary) => {
        event.stopPropagation();
        if (!itinerary.id) {
            return;
        }
        setPendingDeletion({ id: itinerary.id, title: itinerary.title ?? itinerary.destination ?? '行程' });
        setErrorMessage(null);
    };

    const confirmDelete = () => {
        if (!pendingDeletion) {
            return;
        }

        startTransition(async () => {
            const response = await fetch(`/api/itineraries/${pendingDeletion.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                setErrorMessage(payload.error ?? '删除行程时发生错误，请稍后再试。');
                return;
            }

            setPendingDeletion(null);
            router.refresh();
        });
    };

    const cancelDelete = () => {
        setPendingDeletion(null);
        setErrorMessage(null);
    };

    const handleSelect = (itinerary: Itinerary) => {
        if (!onSelect) {
            return;
        }
        void onSelect(itinerary);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">我的行程</h2>
                <span className="rounded-full border border-emerald-400/40 bg-emerald-100/70 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                    共 {sortedItineraries.length} 个计划
                </span>
            </div>

            <ul className="grid gap-4">
                {sortedItineraries.map((itinerary) => (
                    <li
                        key={itinerary.id}
                        role={onSelect ? 'button' : undefined}
                        aria-pressed={onSelect ? selectedId === itinerary.id : undefined}
                        tabIndex={onSelect ? 0 : undefined}
                        onClick={() => handleSelect(itinerary)}
                        onKeyDown={(event: KeyboardEvent<HTMLLIElement>) => {
                            if ((event.key === 'Enter' || event.key === ' ') && onSelect) {
                                event.preventDefault();
                                handleSelect(itinerary);
                            }
                        }}
                        className={`group relative overflow-hidden rounded-3xl border bg-white p-6 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 dark:bg-gradient-to-br dark:from-slate-900/80 dark:via-slate-900/50 dark:to-slate-900/80 ${selectedId === itinerary.id
                                ? 'border-emerald-400/70 shadow-lg shadow-emerald-200/30 dark:border-emerald-400/70 dark:shadow-emerald-500/15'
                                : 'border-slate-200/80 hover:border-emerald-300/60 hover:shadow-lg hover:shadow-emerald-200/20 dark:border-slate-800/80 dark:hover:border-emerald-400/60 dark:hover:shadow-emerald-500/10'
                            }`}
                    >
                        <div className="pointer-events-none absolute -right-20 top-0 h-52 w-52 rounded-full bg-emerald-500/5 blur-3xl transition group-hover:bg-emerald-500/15 dark:bg-emerald-500/10 dark:group-hover:bg-emerald-500/20" />
                        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {itinerary.title || `${itinerary.destination} 行程`}
                                </h3>
                                <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                    <MapPin className="h-4 w-4 text-emerald-500 dark:text-emerald-300" aria-hidden />
                                    {itinerary.destination}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <CalendarRange className="h-4 w-4 text-emerald-500 dark:text-emerald-300" aria-hidden />
                                {formatDateRange(itinerary.start_date, itinerary.end_date)}
                                <span className="mx-2 hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:block" aria-hidden />
                                <Users className="h-4 w-4 text-emerald-500 dark:text-emerald-300" aria-hidden />
                                {itinerary.travelers} 人
                            </div>
                        </div>
                        <div className="relative mt-4 flex flex-col gap-3 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800/60">
                                    最近更新：{formatDate(itinerary.updated_at)}
                                </span>
                                {typeof itinerary.budget === 'number' && (
                                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                                        <Wallet2 className="h-4 w-4" aria-hidden />
                                        预算 ¥{itinerary.budget.toLocaleString('zh-CN')}
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={(event) => handleDelete(event, itinerary)}
                                className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:text-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-rose-400/80 dark:hover:text-rose-300 dark:focus-visible:outline-rose-300"
                            >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                删除
                            </button>
                        </div>
                    </li>
                ))}
            </ul>

            {pendingDeletion && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                    <p className="font-medium">确认删除「{pendingDeletion.title}」吗？该操作不可撤销。</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={confirmDelete}
                            disabled={isPending}
                            className="inline-flex items-center justify-center rounded-full bg-rose-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isPending ? '删除中…' : '确认删除'}
                        </button>
                        <button
                            type="button"
                            onClick={cancelDelete}
                            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
                        >
                            取消
                        </button>
                    </div>
                    {errorMessage && <p className="mt-2 text-xs text-rose-500 dark:text-rose-300">{errorMessage}</p>}
                </div>
            )}
        </div>
    );
}

function formatDateRange(start: string | null, end: string | null) {
    if (!start || !end) {
        return '日期待定';
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return '日期待定';
    }

    return `${formatDate(start)} - ${formatDate(end)}`;
}

function formatDate(value: string | null) {
    if (!value) {
        return '未知';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '未知';
    }

    return dateFormatter.format(date);
}
