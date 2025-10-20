'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { ReactNode } from 'react';
import { CalendarRange, MapPin, Sparkles, Users, Wallet2 } from 'lucide-react';

const DEFAULT_TRAVELERS = 1;

export function CreateItineraryForm() {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [destination, setDestination] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [travelers, setTravelers] = useState(DEFAULT_TRAVELERS);
    const [budget, setBudget] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage(null);

        if (!startDate || !endDate) {
            setMessage('请选择出行时间范围。');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            setMessage('开始日期需早于结束日期。');
            return;
        }

        startTransition(async () => {
            const response = await fetch('/api/itineraries', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: title || `${destination} 行程`,
                    destination,
                    startDate,
                    endDate,
                    travelers,
                    budget: budget ? Number(budget) : null,
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                setMessage(payload.error ?? '创建行程时发生错误，请稍后再试。');
                return;
            }

            setTitle('');
            setDestination('');
            setStartDate('');
            setEndDate('');
            setTravelers(DEFAULT_TRAVELERS);
            setBudget('');
            setMessage('行程已创建，可继续完善内容。');
            router.refresh();
        });
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-emerald-200/20 transition dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-emerald-500/10"
        >
            <div className="pointer-events-none absolute -top-36 right-[-72px] h-56 w-56 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-500/20" />
            <header className="relative flex flex-col gap-2">
                <div className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-100/80 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Sparkles className="h-4 w-4" aria-hidden />
                    极速建旅程
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">快速创建行程</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    填写目标城市与日期，我们将利用偏好和预算生成智能路线草稿。
                </p>
            </header>

            <Field label="行程标题（可选）" icon={<Sparkles className="h-4 w-4" aria-hidden />}>
                <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="樱花追逐之旅"
                    className="form-input"
                />
            </Field>

            <Field label="目的地" icon={<MapPin className="h-4 w-4" aria-hidden />} required>
                <input
                    type="text"
                    required
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                    placeholder="日本 · 东京"
                    className="form-input"
                />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="开始日期" icon={<CalendarRange className="h-4 w-4" aria-hidden />} required>
                    <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        className="form-input"
                    />
                </Field>
                <Field label="结束日期" icon={<CalendarRange className="h-4 w-4" aria-hidden />} required>
                    <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        className="form-input"
                    />
                </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="同行人数" icon={<Users className="h-4 w-4" aria-hidden />}>
                    <input
                        type="number"
                        min={1}
                        value={travelers}
                        onChange={(event) => setTravelers(Number(event.target.value) || DEFAULT_TRAVELERS)}
                        className="form-input"
                    />
                </Field>
                <Field label="预算（人民币，可选）" icon={<Wallet2 className="h-4 w-4" aria-hidden />}>
                    <input
                        type="number"
                        min={0}
                        value={budget}
                        onChange={(event) => setBudget(event.target.value)}
                        placeholder="10000"
                        className="form-input"
                    />
                </Field>
            </div>

            <button
                type="submit"
                disabled={isPending}
                className="mt-2 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:from-emerald-400 hover:via-emerald-300 hover:to-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {isPending ? '创建中…' : '生成旅程草稿'}
            </button>

            {message && (
                <p className="rounded-xl border border-emerald-400/40 bg-emerald-100/80 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                    {message}
                </p>
            )}
        </form>
    );
}

type FieldProps = {
    label: string;
    icon?: ReactNode;
    children: ReactNode;
    required?: boolean;
};

function Field({ label, icon, children, required }: FieldProps) {
    return (
        <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                {icon}
                {label}
                {required && <span className="text-emerald-500 dark:text-emerald-300">*</span>}
            </span>
            {children}
        </label>
    );
}
