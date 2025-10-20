'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CalendarClock, Loader2, Mic, MicOff, PiggyBank, Plus, Receipt, Trash2, Wallet } from 'lucide-react';
import { SPEECH_FALLBACK_MESSAGE, useSpeechRecorder } from '@/lib/client/use-speech-recorder';
import { useExpenseEntries } from '@/lib/client/use-expense-entries';
import { parseExpenseTranscript } from '@/lib/utils/expense-parser';

const DEFAULT_CURRENCY = '¥';

export type BudgetTrackerProps = {
    itineraryId?: string | null;
};

type EntryFormState = {
    category: string;
    amount: string;
    source: 'plan' | 'actual';
    incurredOn: string;
    notes: string;
};

const initialFormState: EntryFormState = {
    category: '',
    amount: '',
    source: 'plan',
    incurredOn: '',
    notes: '',
};

export function BudgetTracker({ itineraryId }: BudgetTrackerProps) {
    const [form, setForm] = useState<EntryFormState>(initialFormState);
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
    const [voiceError, setVoiceError] = useState<string | null>(null);

    const { data, loading, error, createEntry, deleteEntry } = useExpenseEntries(itineraryId ?? undefined);

    const totals = useMemo(() => {
        const plan = data?.totals.plan ?? 0;
        const actual = data?.totals.actual ?? 0;
        const delta = plan - actual;
        return {
            plan,
            actual,
            delta,
        };
    }, [data]);

    const currencySymbol = useMemo(() => {
        if (!data?.currency) {
            return DEFAULT_CURRENCY;
        }
        if (data.currency.toUpperCase() === 'CNY' || data.currency === '人民币') {
            return '¥';
        }
        if (data.currency.toUpperCase() === 'USD') {
            return '$';
        }
        return data.currency.toUpperCase();
    }, [data?.currency]);

    const logVoiceTranscript = useCallback((text: string, payload: Record<string, unknown>) => {
        if (!text.trim()) {
            return;
        }
        void fetch('/api/voice-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript: text, intent: 'expense-input', payload }),
        }).catch(() => undefined);
    }, []);

    const handleVoiceTranscript = useCallback(
        async (transcript: string) => {
            const text = transcript.trim();
            if (!text) {
                return;
            }

            const parsed = parseExpenseTranscript(text);

            if (!parsed.amount) {
                setVoiceMessage(`识别结果：${text}`);
                setVoiceError('未能识别有效金额，请重新描述。');
                return;
            }

            if (!itineraryId) {
                setVoiceError('请先选择或创建行程后再记账。');
                return;
            }

            const category = parsed.category ?? '其他';
            const source = parsed.source ?? 'actual';
            const amount = parsed.amount;

            setVoiceError(null);
            setVoiceMessage(`识别到 ${category} ¥${amount.toFixed(2)}，正在记录…`);

            const success = await createEntry({
                category,
                amount,
                source,
                notes: parsed.notes ?? text,
                incurredOn: parsed.incurredOn,
            });

            if (success) {
                setVoiceMessage(`已记录 ${category} ¥${amount.toFixed(2)}（${source === 'plan' ? '计划' : '实际'}）`);
                logVoiceTranscript(text, {
                    amount,
                    category,
                    source,
                    incurredOn: parsed.incurredOn,
                });
            } else {
                setVoiceError('语音记账失败，请稍后重试。');
            }
        },
        [createEntry, itineraryId, logVoiceTranscript],
    );

    const {
        supportsSpeech,
        isListening: isVoiceListening,
        isProcessing: isVoiceProcessing,
        error: voiceRecorderError,
        toggleRecording: toggleVoiceRecording,
        clearError: clearVoiceRecorderError,
    } = useSpeechRecorder({
        onTranscript: handleVoiceTranscript,
    });

    const handleToggleVoice = useCallback(() => {
        if (!supportsSpeech) {
            setVoiceError(SPEECH_FALLBACK_MESSAGE);
            return;
        }
        if (!isVoiceListening) {
            clearVoiceRecorderError();
            setVoiceError(null);
            setVoiceMessage(null);
        }
        void toggleVoiceRecording();
    }, [supportsSpeech, isVoiceListening, clearVoiceRecorderError, toggleVoiceRecording]);

    const resetForm = () => {
        setForm(initialFormState);
        setFormError(null);
    };

    const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!itineraryId) {
            setFormError('请选择或创建行程后再添加预算条目。');
            return;
        }

        const amountNumber = Number(form.amount);

        if (!form.category.trim()) {
            setFormError('请输入费用类别。');
            return;
        }

        if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
            setFormError('请输入有效的金额。');
            return;
        }

        setIsSubmitting(true);
        setFormError(null);

        const success = await createEntry({
            category: form.category.trim(),
            amount: amountNumber,
            source: form.source,
            notes: form.notes.trim() ? form.notes.trim() : null,
            incurredOn: form.incurredOn ? form.incurredOn : null,
        });

        setIsSubmitting(false);

        if (success) {
            resetForm();
        }
    };

    const handleDelete = async (entryId: string) => {
        await deleteEntry(entryId);
    };

    const renderEmptyState = () => {
        if (!itineraryId) {
            return '请选择一个行程以查看预算明细。';
        }

        if (loading) {
            return '加载预算数据中…';
        }

        if (error) {
            return error;
        }

        return '暂无费用记录，先创建一条计划或实际支出。';
    };

    return (
        <section className="flex h-full flex-col gap-6 rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-lg shadow-emerald-200/20 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/70">
            <header className="flex flex-col gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                    <PiggyBank className="h-4 w-4" aria-hidden />
                    预算追踪器
                </span>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    管理计划与实际费用，掌控旅行开支
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                    新增预算或实付记录时，会自动更新汇总并同步至数据库。
                </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-3">
                <BudgetSummaryCard
                    label="计划预算"
                    amount={totals.plan}
                    icon={<Wallet className="h-4 w-4" aria-hidden />}
                    highlight="plan"
                    currency={currencySymbol}
                />
                <BudgetSummaryCard
                    label="实际支出"
                    amount={totals.actual}
                    icon={<Receipt className="h-4 w-4" aria-hidden />}
                    highlight="actual"
                    currency={currencySymbol}
                />
                <BudgetSummaryCard
                    label="预算差额"
                    amount={totals.delta}
                    icon={<CalendarClock className="h-4 w-4" aria-hidden />}
                    highlight={totals.delta >= 0 ? 'positive' : 'negative'}
                    currency={currencySymbol}
                />
            </div>

            <form onSubmit={handleFormSubmit} className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 text-sm dark:border-slate-700/60 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">新增预算条目</h3>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleToggleVoice}
                            disabled={loading || isSubmitting || isVoiceProcessing}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-emerald-400 hover:text-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:border-emerald-400/70 dark:hover:text-emerald-300"
                        >
                            {isVoiceProcessing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                    识别中…
                                </>
                            ) : isVoiceListening ? (
                                <>
                                    <MicOff className="h-4 w-4" aria-hidden />
                                    停止语音记账
                                </>
                            ) : (
                                <>
                                    <Mic className="h-4 w-4" aria-hidden />
                                    语音记账
                                </>
                            )}
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || loading}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}添加
                        </button>
                    </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                        类别
                        <input
                            type="text"
                            value={form.category}
                            onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                            placeholder="交通 / 酒店 / 餐饮"
                            className="form-input"
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                        金额
                        <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={form.amount}
                            onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                            placeholder="1200"
                            className="form-input"
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                        记录类型
                        <select
                            value={form.source}
                            onChange={(event) =>
                                setForm((prev) => ({ ...prev, source: event.target.value as EntryFormState['source'] }))
                            }
                            className="form-input"
                        >
                            <option value="plan">计划预算</option>
                            <option value="actual">实际支出</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                        发生日期（可选）
                        <input
                            type="date"
                            value={form.incurredOn}
                            onChange={(event) => setForm((prev) => ({ ...prev, incurredOn: event.target.value }))}
                            className="form-input"
                        />
                    </label>
                </div>
                <label className="mt-4 flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                    备注（可选）
                    <textarea
                        rows={2}
                        value={form.notes}
                        onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                        placeholder="例如：机票预订、酒店定金、餐饮体验"
                        className="form-input resize-none"
                    />
                </label>
                <div className="mt-3 space-y-1 text-xs">
                    {voiceMessage && <p className="text-emerald-600 dark:text-emerald-300">{voiceMessage}</p>}
                    {(voiceError || voiceRecorderError) && (
                        <p className="text-rose-500 dark:text-rose-300">{voiceError || voiceRecorderError}</p>
                    )}
                    {!supportsSpeech && (
                        <p className="text-amber-600 dark:text-amber-300">{SPEECH_FALLBACK_MESSAGE}</p>
                    )}
                </div>
                {(formError || error) && (
                    <p className="mt-3 text-xs text-rose-500 dark:text-rose-300">{formError || error}</p>
                )}
            </form>

            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">费用条目</h3>
                {data?.entries && data.entries.length > 0 ? (
                    <ul className="space-y-3">
                        {data.entries.map((entry) => (
                            <li
                                key={entry.id}
                                className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm text-slate-600 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {entry.category}
                                    </span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        {entry.source === 'plan' ? '计划预算' : '实际支出'} · {currencySymbol}
                                        {entry.amount.toLocaleString('zh-CN', {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 2,
                                        })}
                                    </span>
                                    {entry.notes && <span className="text-xs text-slate-500 dark:text-slate-400">{entry.notes}</span>}
                                    <span className="text-xs text-slate-400 dark:text-slate-500">
                                        {formatEntryDate(entry.incurredOn ?? entry.createdAt)}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(entry.id)}
                                    className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:text-rose-500 dark:border-slate-600 dark:text-slate-300 dark:hover:border-rose-300/80 dark:hover:text-rose-300"
                                >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                    删除
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="rounded-2xl border border-dashed border-slate-300/60 bg-slate-50/70 px-4 py-6 text-center text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-800/30 dark:text-slate-400">
                        {renderEmptyState()}
                    </p>
                )}
            </div>
        </section>
    );
}

type BudgetSummaryCardProps = {
    label: string;
    amount: number;
    icon: ReactNode;
    highlight: 'plan' | 'actual' | 'positive' | 'negative';
    currency: string;
};

function BudgetSummaryCard({ label, amount, icon, highlight, currency }: BudgetSummaryCardProps) {
    const accentClass =
        highlight === 'plan'
            ? 'bg-emerald-500/10 text-emerald-600'
            : highlight === 'actual'
                ? 'bg-amber-500/10 text-amber-600'
                : highlight === 'positive'
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-rose-500/10 text-rose-600';

    return (
        <div className={`flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/40`}>
            <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${accentClass}`}>
                {icon}
                {label}
            </span>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {currency}
                {amount.toLocaleString('zh-CN', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                })}
            </p>
        </div>
    );
}

function formatEntryDate(value: string | null) {
    if (!value) {
        return '刚刚创建';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '未知日期';
    }

    return new Intl.DateTimeFormat('zh-CN', {
        dateStyle: 'medium',
    }).format(date);
}
