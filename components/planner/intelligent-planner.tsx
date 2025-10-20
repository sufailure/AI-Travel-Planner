'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Sparkles } from 'lucide-react';

type PlannerResult = {
    overview: string;
    dailyPlan: Array<{
        title: string;
        summary: string;
        activities: string[];
        meals: string[];
    }>;
    transportation: string[];
    accommodations: string[];
    restaurants: string[];
    estimatedBudget: Array<{
        category: string;
        amount: number;
        currency: string;
        notes: string;
    }>;
    tips: string[];
};

const FALLBACK_MESSAGE = '语音识别不可用，请改用文字输入。';

type RecorderController = {
    start: () => Promise<void>;
    stop: () => Promise<string | null>;
    dispose: () => void;
};

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

export function IntelligentPlanner() {
    const [destination, setDestination] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [travelers, setTravelers] = useState(2);
    const [budget, setBudget] = useState('');
    const [preferences, setPreferences] = useState('');
    const [supportsSpeech, setSupportsSpeech] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<PlannerResult | null>(null);
    const [rawPlan, setRawPlan] = useState<string | null>(null);
    const recorderRef = useRef<RecorderController | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            setSupportsSpeech(false);
            return;
        }

        let stream: MediaStream | null = null;
        let audioContext: AudioContext | null = null;
        let processor: ScriptProcessorNode | null = null;
        let chunks: Float32Array[] = [];

        const cleanup = () => {
            processor?.disconnect();
            processor = null;
            if (audioContext) {
                audioContext.close().catch(() => undefined);
                audioContext = null;
            }
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
                stream = null;
            }
            chunks = [];
        };

        const startRecording = async () => {
            setError(null);
            setIsListening(true);

            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (err) {
                setIsListening(false);
                cleanup();
                throw new Error('获取麦克风权限失败，请检查系统设置。');
            }

            try {
                audioContext = new AudioContext();
            } catch (error) {
                setIsListening(false);
                cleanup();
                throw new Error('浏览器不支持录音播放环境，请更换浏览器重试。');
            }
            const source = audioContext.createMediaStreamSource(stream);
            const bufferSize = 4096;
            processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
            chunks = [];

            processor.onaudioprocess = (event) => {
                const data = event.inputBuffer.getChannelData(0);
                chunks.push(new Float32Array(data));
            };

            const silenceGain = audioContext.createGain();
            silenceGain.gain.value = 0;

            source.connect(processor);
            processor.connect(silenceGain);
            silenceGain.connect(audioContext.destination);
        };

        const stopRecording = async () => {
            if (!audioContext) {
                cleanup();
                return null;
            }

            const sampleRate = audioContext.sampleRate;
            const recordedChunks = chunks;
            cleanup();

            if (!recordedChunks.length) {
                return null;
            }

            const merged = mergeBuffers(recordedChunks);
            const resampled = resampleBuffer(merged, sampleRate, 16000);
            const pcm = floatTo16BitPCM(resampled);
            const base64 = arrayBufferToBase64(pcm.buffer);

            const response = await fetch('/api/speech/transcribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ audio: base64 }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                const errMsg = (data as { error?: string }).error ?? '语音识别失败，请稍后重试。';
                throw new Error(errMsg);
            }

            const data = (await response.json()) as { text?: string };
            return data.text?.trim() ? data.text.trim() : null;
        };

        recorderRef.current = {
            start: startRecording,
            stop: stopRecording,
            dispose: cleanup,
        };

        setSupportsSpeech(true);

        return () => {
            recorderRef.current?.dispose();
            recorderRef.current = null;
        };
    }, []);

    const toggleListening = useCallback(async () => {
        if (!supportsSpeech || !recorderRef.current) {
            setError(FALLBACK_MESSAGE);
            return;
        }

        if (isListening) {
            setIsListening(false);
            setIsTranscribing(true);
            try {
                const text = await recorderRef.current.stop();
                if (text) {
                    setPreferences((current) => (current ? `${current.trim()}
${text}` : text));
                    applyParsedDetails(text);
                }
            } catch (err) {
                console.error('Speech transcription failed', err);
                setError(err instanceof Error ? err.message : '语音识别失败，请稍后再试。');
            } finally {
                setIsTranscribing(false);
            }
        } else {
            try {
                await recorderRef.current.start();
            } catch (err) {
                console.error('Speech recorder start failed', err);
                setError(err instanceof Error ? err.message : '无法启动语音输入。');
                setIsListening(false);
            }
        }
    }, [supportsSpeech, isListening, applyParsedDetails]);

    const canSubmit = useMemo(() => {
        return destination.trim().length > 0 || preferences.trim().length > 0;
    }, [destination, preferences]);

    const handleSubmit = useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (!canSubmit) {
                setError('请至少提供目的地或语音描述。');
                return;
            }

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

            setIsSubmitting(true);
            setError(null);
            setResult(null);
            setRawPlan(null);

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
                    setError((data as { error?: string }).error ?? '生成行程失败，请稍后重试。');
                    return;
                }

                const data = (await response.json()) as GenerateResponse;
                setResult(data.plan);
                setRawPlan(data.raw);
            } catch (err) {
                console.error('Generate itinerary failed', err);
                setError('生成行程失败，请检查网络连接。');
            } finally {
                setIsSubmitting(false);
            }
        },
        [canSubmit, destination, startDate, endDate, travelers, budget, preferences],
    );

    const renderDailyPlan = () => {
        if (!result?.dailyPlan?.length) {
            return null;
        }

        return (
            <div className="mt-6 grid gap-4">
                {result.dailyPlan.map((day, index) => (
                    <div
                        key={`${day.title}-${index}`}
                        className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60"
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

            <form onSubmit={handleSubmit} className="relative mt-6 grid gap-4">
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
                        <button
                            type="button"
                            onClick={() => void toggleListening()}
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
                            <p className="text-xs text-amber-600 dark:text-amber-300">{FALLBACK_MESSAGE}</p>
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
                    {rawPlan && (
                        <details className="text-xs text-slate-500 dark:text-slate-400">
                            <summary className="cursor-pointer select-none">查看 AI 原始回复</summary>
                            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900/80 p-3 text-[11px] text-emerald-100">
                                {rawPlan}
                            </pre>
                        </details>
                    )}
                </div>

                {error && (
                    <p className="rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-2 text-sm text-amber-700 dark:border-amber-400/60 dark:bg-amber-500/10 dark:text-amber-200">
                        {error}
                    </p>
                )}
            </form>

            {result && (
                <div className="relative mt-8 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 text-slate-700 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-slate-200">
                    <h3 className="text-lg font-semibold text-emerald-700 dark:text-emerald-200">AI 行程概览</h3>
                    <p className="mt-2 text-sm leading-relaxed">{result.overview}</p>

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
                        <div className="mt-6">
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

                    {result.tips.length > 0 && (
                        <SectionList title="贴士" items={result.tips} />
                    )}

                    {renderDailyPlan()}
                </div>
            )}
        </section>
    );
}

type SectionListProps = {
    title: string;
    items: string[];
};

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

function mergeBuffers(chunks: Float32Array[]) {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}

function resampleBuffer(buffer: Float32Array, originalRate: number, targetRate: number) {
    if (originalRate === targetRate) {
        return buffer;
    }

    const ratio = originalRate / targetRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i += 1) {
        const index = i * ratio;
        const leftIndex = Math.floor(index);
        const rightIndex = Math.min(Math.ceil(index), buffer.length - 1);
        const weight = index - leftIndex;
        const leftValue = buffer[leftIndex] ?? 0;
        const rightValue = buffer[rightIndex] ?? 0;
        result[i] = leftValue + (rightValue - leftValue) * weight;
    }

    return result;
}

function floatTo16BitPCM(buffer: Float32Array) {
    const output = new ArrayBuffer(buffer.length * 2);
    const view = new DataView(output);

    for (let i = 0; i < buffer.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, buffer[i] ?? 0));
        view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }

    return view;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

type ParsedTripDetails = {
    destination?: string;
    budget?: number;
    travelers?: number;
    startDate?: string;
    endDate?: string;
};

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
