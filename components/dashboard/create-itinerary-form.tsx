'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

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
            className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
        >
            <div>
                <h2 className="text-lg font-semibold text-white">快速创建行程</h2>
                <p className="mt-1 text-sm text-slate-400">
                    填写目的地和日期，我们将基于偏好生成初版计划。
                </p>
            </div>

            <label className="text-sm text-slate-300">
                行程标题（可选）
                <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="樱花追逐之旅"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-400"
                />
            </label>

            <label className="text-sm text-slate-300">
                目的地
                <input
                    type="text"
                    required
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                    placeholder="日本 东京"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-400"
                />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-slate-300">
                    开始日期
                    <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-400"
                    />
                </label>

                <label className="text-sm text-slate-300">
                    结束日期
                    <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-400"
                    />
                </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-slate-300">
                    同行人数
                    <input
                        type="number"
                        min={1}
                        value={travelers}
                        onChange={(event) => setTravelers(Number(event.target.value) || DEFAULT_TRAVELERS)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-400"
                    />
                </label>

                <label className="text-sm text-slate-300">
                    预算（可选，人民币）
                    <input
                        type="number"
                        min={0}
                        value={budget}
                        onChange={(event) => setBudget(event.target.value)}
                        placeholder="10000"
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-400"
                    />
                </label>
            </div>

            <button
                type="submit"
                disabled={isPending}
                className="mt-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {isPending ? '创建中…' : '创建行程'}
            </button>

            {message && <p className="text-sm text-amber-300">{message}</p>}
        </form>
    );
}
