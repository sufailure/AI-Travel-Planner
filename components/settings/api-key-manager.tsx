'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
    Check,
    ClipboardCopy,
    ClipboardPaste,
    Eye,
    EyeOff,
    KeyRound,
    Loader2,
    Sparkles,
    Trash2,
    Wand2,
} from 'lucide-react';

import {
    loadActiveLlmKeyId,
    loadStoredApiKeys,
    persistActiveLlmKeyId,
    persistStoredApiKeys,
    removeStoredApiKey,
    resolveActiveLlmKeyValue,
    upsertStoredApiKey,
    type StoredApiKey,
} from '@/lib/client/llm-key-storage';

const INPUT_STYLE =
    'rounded-2xl border border-slate-300/70 bg-white px-4 py-2 text-[13px] text-slate-700 shadow-inner shadow-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-200 dark:shadow-none dark:focus:border-emerald-400/70 dark:focus:ring-emerald-500/20';
const TEXTAREA_STYLE =
    'min-h-[200px] w-full resize-y rounded-2xl border border-slate-300/70 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-inner shadow-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-200 dark:shadow-none dark:focus:border-emerald-400/70 dark:focus:ring-emerald-500/20';

type VisibilityState = Record<string, boolean>;

type ParsedCandidate = {
    id: string;
    label: string;
    value: string;
    source: string;
};

const KEY_LIKE_REGEX = /(sk-|pk_|^hf_|^lk_|^qq-|^AIza|^SG\.|[A-Za-z0-9_\-]{20,})/;

const maskKey = (value: string) => {
    if (!value) {
        return '';
    }
    if (value.length <= 6) {
        return '*'.repeat(value.length);
    }
    return `${value.slice(0, 4)}····${value.slice(-2)}`;
};

const sanitizeToken = (token: string) => token.replace(/^['"`]+/, '').replace(/['"`]+$/, '').trim();

const createId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const looksLikeKey = (value: string) => {
    const cleaned = sanitizeToken(value);
    return cleaned.length >= 12 && KEY_LIKE_REGEX.test(cleaned);
};

const splitWithSeparators = (line: string) => {
    const candidates = ['=', '=>', ':', '：'];
    for (const separator of candidates) {
        const index = line.indexOf(separator);
        if (index > 0) {
            const label = sanitizeToken(line.slice(0, index));
            const value = sanitizeToken(line.slice(index + separator.length));
            if (value) {
                return { label, value };
            }
        }
    }
    return null;
};

const smartParseApiKeys = (input: string): Array<{ label: string; value: string; source: string }> => {
    const normalized = input.replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');
    const unique = new Map<string, { label: string; value: string; source: string }>();

    const jsonMatches = Array.from(
        normalized.matchAll(/"([^"\n]*key[^"\n]*)"\s*:\s*"([^"\n]+)"/gi),
    );

    for (const match of jsonMatches) {
        const label = sanitizeToken(match[1]);
        const value = sanitizeToken(match[2]);
        if (looksLikeKey(value)) {
            const key = `${label}::${value}`;
            if (!unique.has(key)) {
                unique.set(key, { label, value, source: `${label}: ${value}` });
            }
        }
    }

    let pendingLabel: string | null = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || /^(#|\/\/)/.test(line)) {
            continue;
        }

        const separated = splitWithSeparators(line);
        if (separated) {
            const { label, value } = separated;
            if (looksLikeKey(value)) {
                const cleanedLabel = sanitizeToken(label);
                const cleanedValue = sanitizeToken(value);
                const key = `${cleanedLabel}::${cleanedValue}`;
                if (!unique.has(key)) {
                    unique.set(key, { label: cleanedLabel, value: cleanedValue, source: rawLine.trim() });
                }
                pendingLabel = null;
                continue;
            }
            pendingLabel = sanitizeToken(label) || pendingLabel;
            continue;
        }

        if (pendingLabel && looksLikeKey(line)) {
            const cleanedLabel = sanitizeToken(pendingLabel);
            const cleanedValue = sanitizeToken(line);
            const key = `${cleanedLabel}::${cleanedValue}`;
            if (!unique.has(key)) {
                unique.set(key, { label: cleanedLabel, value: cleanedValue, source: rawLine.trim() });
            }
            pendingLabel = null;
            continue;
        }

        const tokens = line.split(/\s+/);
        if (tokens.length >= 2) {
            const possibleValue = sanitizeToken(tokens[tokens.length - 1]);
            if (looksLikeKey(possibleValue)) {
                const candidateLabel = sanitizeToken(tokens.slice(0, -1).join(' '));
                const key = `${candidateLabel}::${possibleValue}`;
                if (!unique.has(key)) {
                    unique.set(key, { label: candidateLabel, value: possibleValue, source: rawLine.trim() });
                }
                pendingLabel = null;
                continue;
            }
        }

        if (looksLikeKey(line)) {
            const cleanedValue = sanitizeToken(line);
            const key = `::${cleanedValue}`;
            if (!unique.has(key)) {
                unique.set(key, { label: '', value: cleanedValue, source: rawLine.trim() });
            }
            pendingLabel = null;
            continue;
        }

        pendingLabel = sanitizeToken(line);
    }

    return Array.from(unique.values());
};

export function ApiKeyManager() {
    const [entries, setEntries] = useState<StoredApiKey[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [label, setLabel] = useState('');
    const [value, setValue] = useState('');
    const [rawInput, setRawInput] = useState('');
    const [parsedCandidates, setParsedCandidates] = useState<ParsedCandidate[]>([]);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [visibility, setVisibility] = useState<VisibilityState>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [verifyingId, setVerifyingId] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const storedEntries = loadStoredApiKeys();
        setEntries(storedEntries);

        const storedActiveId = loadActiveLlmKeyId();
        if (storedActiveId && storedEntries.some((entry) => entry.id === storedActiveId)) {
            setActiveId(storedActiveId);
            return;
        }

        if (storedEntries[0]) {
            const fallbackId = storedEntries[0].id;
            setActiveId(fallbackId);
            persistActiveLlmKeyId(fallbackId);
        }
    }, []);

    const persistEntries = useCallback((next: StoredApiKey[]) => {
        persistStoredApiKeys(next);
    }, []);

    const resetForm = useCallback(() => {
        setLabel('');
        setValue('');
    }, []);

    const parseAndPreview = useCallback(
        (input: string) => {
            const results = smartParseApiKeys(input);
            if (results.length === 0) {
                setParsedCandidates([]);
                setStatusMessage(null);
                setErrorMessage('未能解析出任何 API Key，请检查格式或补充命名。');
                return false;
            }

            setParsedCandidates(results.map((item) => ({ id: createId(), ...item })));
            setErrorMessage(null);
            setStatusMessage(`解析完成，识别到 ${results.length} 条密钥候选。`);

            if (results.length === 1) {
                setLabel(results[0].label);
                setValue(results[0].value);
            }

            return true;
        },
        [],
    );

    const handleSave = useCallback(
        (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const normalizedLabel = label.trim();
            const normalizedValue = value.trim();

            if (!normalizedValue) {
                setErrorMessage('请输入有效的 API Key。');
                return;
            }

            if (!normalizedLabel) {
                setErrorMessage('请为 API Key 取一个名称，方便识别。');
                return;
            }

            setErrorMessage(null);

            let savedEntryId: string | null = null;
            setEntries((prev) => {
                const nextEntries = upsertStoredApiKey(prev, {
                    label: normalizedLabel,
                    value: normalizedValue,
                });

                persistEntries(nextEntries);

                const updated = nextEntries.find((item) => item.label === normalizedLabel);
                savedEntryId = updated?.id ?? resolveActiveLlmKeyValue(nextEntries).id;

                return nextEntries;
            });

            if (savedEntryId) {
                setActiveId(savedEntryId);
                persistActiveLlmKeyId(savedEntryId);
            }

            setStatusMessage('已保存到本地浏览器，仅当前设备可见。');
            resetForm();
        },
        [label, persistEntries, resetForm, value],
    );

    const handleDelete = useCallback(
        (id: string) => {
            let nextEntriesSnapshot: StoredApiKey[] = [];

            setEntries((prev) => {
                const nextEntries = removeStoredApiKey(prev, id);
                persistEntries(nextEntries);
                nextEntriesSnapshot = nextEntries;
                return nextEntries;
            });

            const nextActiveId = (() => {
                if (nextEntriesSnapshot.length === 0) {
                    return null;
                }
                if (activeId && activeId !== id && nextEntriesSnapshot.some((entry) => entry.id === activeId)) {
                    return activeId;
                }
                return nextEntriesSnapshot[0].id;
            })();

            setActiveId(nextActiveId);
            persistActiveLlmKeyId(nextActiveId);
            setStatusMessage('已删除该密钥。');
        },
        [activeId, persistEntries],
    );

    const handleToggleVisibility = useCallback((id: string) => {
        setVisibility((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    }, []);

    const handleSetActive = useCallback(
        (id: string) => {
            if (id === activeId) {
                setStatusMessage('该密钥已经在使用中。');
                return;
            }

            setActiveId(id);
            persistActiveLlmKeyId(id);
            setStatusMessage('已设为当前使用的密钥。');
        },
        [activeId],
    );

    const handleVerify = useCallback(async (id: string, keyValue: string) => {
        const normalizedValue = keyValue.trim();
        if (!normalizedValue) {
            setErrorMessage('该密钥为空，无法验证。');
            return;
        }

        setVerifyingId(id);
        setErrorMessage(null);
        setStatusMessage(null);

        try {
            const response = await fetch('/api/llm/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ llmKey: normalizedValue }),
            });

            const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };

            if (!response.ok || !result.ok) {
                const detail = typeof result.error === 'string' ? result.error.trim() : '';
                setErrorMessage(detail || '验证失败，请检查密钥是否正确或稍后再试。');
                return;
            }

            setStatusMessage('验证成功，可用于智能规划。');
        } catch (error) {
            console.error('Verify LLM key failed', error);
            setErrorMessage('验证失败，请检查网络连接或稍后再试。');
        } finally {
            setVerifyingId(null);
        }
    }, []);

    const handleCopy = useCallback(async (id: string, keyValue: string) => {
        if (typeof navigator === 'undefined' || !navigator.clipboard) {
            setErrorMessage('当前浏览器不支持快速复制，请手动选择复制。');
            return;
        }

        try {
            await navigator.clipboard.writeText(keyValue);
            setCopiedId(id);
            setStatusMessage('已复制到剪贴板。');
            setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
        } catch (error) {
            console.error('Clipboard copy failed', error);
            setErrorMessage('复制失败，请检查浏览器权限。');
        }
    }, []);

    const handlePasteFromClipboard = useCallback(async () => {
        if (typeof navigator === 'undefined' || !navigator.clipboard) {
            setErrorMessage('无法读取剪贴板，请手动粘贴。');
            return;
        }

        try {
            const clipboardText = await navigator.clipboard.readText();
            if (!clipboardText.trim()) {
                setErrorMessage('剪贴板为空，无法解析。');
                return;
            }
            setRawInput(clipboardText);
            parseAndPreview(clipboardText);
        } catch (error) {
            console.error('Clipboard read failed', error);
            setErrorMessage('读取剪贴板失败，请检查浏览器权限。');
        }
    }, [parseAndPreview]);

    const handleParseRaw = useCallback(() => {
        if (!rawInput.trim()) {
            setErrorMessage('请先粘贴或输入待解析的内容。');
            return;
        }
        parseAndPreview(rawInput);
    }, [parseAndPreview, rawInput]);

    const handleApplyCandidate = useCallback((candidate: ParsedCandidate) => {
        const normalizedLabel = candidate.label.trim();
        setLabel(normalizedLabel);
        setValue(candidate.value);
        setToastMessage('已填入表单，请下滑至表单确认并保存。');
    }, []);

    const handleApplyAndSave = useCallback(
        (candidate: ParsedCandidate) => {
            const normalizedLabel = candidate.label.trim() || '未命名密钥';
            const normalizedValue = candidate.value.trim();
            let savedEntryId: string | null = null;

            setEntries((prev) => {
                const nextEntries = upsertStoredApiKey(prev, {
                    label: normalizedLabel,
                    value: normalizedValue,
                });

                persistEntries(nextEntries);

                const updated = nextEntries.find(
                    (item) => item.label === normalizedLabel && item.value === normalizedValue,
                );
                savedEntryId = updated?.id ?? resolveActiveLlmKeyValue(nextEntries).id;

                return nextEntries;
            });

            if (savedEntryId) {
                setActiveId(savedEntryId);
                persistActiveLlmKeyId(savedEntryId);
            }

            setLabel(normalizedLabel);
            setValue(candidate.value);
            setToastMessage('已自动保存到本地。');
        },
        [persistEntries],
    );

    useEffect(() => {
        if (!statusMessage) {
            return;
        }
        const timer = window.setTimeout(() => setStatusMessage(null), 2600);
        return () => window.clearTimeout(timer);
    }, [statusMessage]);

    useEffect(() => {
        if (!toastMessage) {
            return;
        }
        const timer = window.setTimeout(() => setToastMessage(null), 2400);
        return () => window.clearTimeout(timer);
    }, [toastMessage]);

    const sortedEntries = useMemo(
        () => [...entries].sort((a, b) => b.createdAt - a.createdAt),
        [entries],
    );

    const activeEntry = useMemo(
        () => entries.find((entry) => entry.id === activeId) ?? null,
        [activeId, entries],
    );

    return (
        <>
            <div className="flex flex-col gap-6">
                <section className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-lg shadow-emerald-200/20 dark:border-slate-700/60 dark:bg-slate-900/70">
                    <header className="flex flex-col gap-2">
                        <span className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                            <KeyRound className="h-4 w-4" aria-hidden />
                            API Key 管理
                        </span>
                        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">为不同服务安全存放密钥</h1>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                            密钥仅保存在本地浏览器的 LocalStorage 中，不会同步到服务器。请勿将密钥写入代码仓库。
                        </p>
                    </header>

                    <div className="mt-6 space-y-6">
                        <section className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-xs text-slate-600 shadow-inner dark:border-slate-600/60 dark:bg-slate-900/60 dark:text-slate-300">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                                    <Wand2 className="h-4 w-4" aria-hidden />
                                    快速粘贴解析
                                </h2>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                    支持格式：name: key、ENV=key、JSON &quot;xx_key&quot;:&quot;value&quot;、以及「名称 空格 key」。
                                </p>
                            </div>
                            <textarea
                                value={rawInput}
                                onChange={(event) => {
                                    setRawInput(event.target.value);
                                    setParsedCandidates([]);
                                }}
                                placeholder="可以直接粘贴整段配置，例如：OPENAI_API_KEY=sk-..."
                                className={TEXTAREA_STYLE}
                            />
                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold">
                                <button
                                    type="button"
                                    onClick={handlePasteFromClipboard}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 px-4 py-2 text-slate-600 transition hover:border-emerald-400 hover:text-emerald-500 dark:border-slate-600 dark:text-slate-300 dark:hover:border-emerald-400/70 dark:hover:text-emerald-200"
                                >
                                    <ClipboardPaste className="h-4 w-4" aria-hidden />
                                    读取剪贴板
                                </button>
                                <button
                                    type="button"
                                    onClick={handleParseRaw}
                                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-white transition hover:bg-emerald-400"
                                >
                                    <Wand2 className="h-4 w-4" aria-hidden />
                                    智能解析
                                </button>
                            </div>

                            {parsedCandidates.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-500/80 dark:text-emerald-300/90">
                                        解析结果
                                    </p>
                                    <ul className="space-y-2">
                                        {parsedCandidates.map((candidate) => (
                                            <li
                                                key={candidate.id}
                                                className="flex flex-col gap-2 rounded-xl border border-emerald-400/50 bg-emerald-50/60 p-3 text-xs text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <div className="flex flex-col gap-1 sm:flex-1 sm:min-w-0">
                                                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-100">
                                                        {candidate.label || '未命名'}
                                                    </span>
                                                    <span className="max-w-full break-all font-mono text-[12px] text-emerald-700/90 dark:text-emerald-100/90">
                                                        {candidate.value}
                                                    </span>
                                                    <span className="max-w-full break-all text-[10px] text-emerald-500/80 dark:text-emerald-200/70">
                                                        来源：{candidate.source}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold sm:justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApplyCandidate(candidate)}
                                                        className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/80 px-4 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-100/80 dark:border-emerald-500/60 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                                                    >
                                                        填入表单
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApplyAndSave(candidate)}
                                                        className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 dark:hover:bg-emerald-400"
                                                    >
                                                        填入并保存
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </section>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600 dark:text-slate-300">
                                <label className="flex min-w-[220px] flex-1 flex-col gap-1">
                                    命名（例如：OpenAI）
                                    <input
                                        type="text"
                                        value={label}
                                        onChange={(event) => setLabel(event.target.value)}
                                        placeholder="服务名称"
                                        className={INPUT_STYLE}
                                    />
                                </label>
                                <label className="flex min-w-[220px] flex-[2] flex-col gap-1">
                                    API Key
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={(event) => setValue(event.target.value)}
                                        placeholder="sk-..."
                                        className={INPUT_STYLE}
                                    />
                                </label>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-white transition hover:bg-emerald-400"
                                >
                                    保存到本地
                                </button>
                            </div>

                            {(errorMessage || statusMessage) && (
                                <div className="space-y-1 text-xs">
                                    {errorMessage && <p className="text-rose-500 dark:text-rose-300">{errorMessage}</p>}
                                    {statusMessage && !errorMessage && (
                                        <p className="text-emerald-600 dark:text-emerald-300">{statusMessage}</p>
                                    )}
                                </div>
                            )}
                        </form>
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-lg shadow-emerald-200/20 dark:border-slate-700/60 dark:bg-slate-900/70">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">已保存的密钥</h2>
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        当前用于智能规划：
                        {activeEntry ? (
                            <span className="ml-1 font-semibold text-slate-700 dark:text-slate-200">{activeEntry.label}</span>
                        ) : (
                            <span className="ml-1 text-slate-400 dark:text-slate-500">尚未选择，请设置一个密钥。</span>
                        )}
                    </p>
                    {sortedEntries.length === 0 ? (
                        <p className="mt-4 rounded-2xl border border-dashed border-slate-300/70 bg-slate-50/80 px-4 py-6 text-center text-xs text-slate-500 dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-400">
                            尚未保存任何 API Key，可通过上方表单添加。
                        </p>
                    ) : (
                        <ul className="mt-4 space-y-3">
                            {sortedEntries.map((entry) => {
                                const isVisible = visibility[entry.id];
                                const displayValue = isVisible ? entry.value : maskKey(entry.value);
                                const isCopied = copiedId === entry.id;
                                const isActive = entry.id === activeId;

                                return (
                                    <li
                                        key={entry.id}
                                        className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/90 p-4 text-xs text-slate-600 shadow-sm transition hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="flex flex-col gap-1 sm:flex-1 sm:min-w-0">
                                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                {entry.label}
                                                {isActive && (
                                                    <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-200">
                                                        当前使用
                                                    </span>
                                                )}
                                            </span>
                                            <span className="max-w-full break-all font-mono text-sm text-slate-700 dark:text-slate-200">{displayValue}</span>
                                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                                {new Date(entry.createdAt).toLocaleString('zh-CN')}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                                            <button
                                                type="button"
                                                onClick={() => handleSetActive(entry.id)}
                                                disabled={isActive}
                                                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 transition ${isActive
                                                        ? 'cursor-default border border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400/80 dark:bg-emerald-500/90 dark:text-slate-900'
                                                        : 'border border-emerald-300 text-emerald-500 hover:border-emerald-400 hover:bg-emerald-100/80 dark:border-emerald-500/50 dark:text-emerald-200 dark:hover:border-emerald-400/70 dark:hover:bg-emerald-500/15'
                                                    }`}
                                            >
                                                {isActive ? (
                                                    <>
                                                        <Check className="h-3.5 w-3.5" aria-hidden />
                                                        当前使用
                                                    </>
                                                ) : (
                                                    <>
                                                        <KeyRound className="h-3.5 w-3.5" aria-hidden />
                                                        设为当前
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleVerify(entry.id, entry.value)}
                                                disabled={verifyingId === entry.id}
                                                className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 transition hover:border-emerald-400 hover:text-emerald-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-600 dark:text-slate-300 dark:hover:border-emerald-400/70 dark:hover:text-emerald-200"
                                            >
                                                {verifyingId === entry.id ? (
                                                    <>
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                                        验证中
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="h-3.5 w-3.5" aria-hidden />
                                                        验证可用性
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleVisibility(entry.id)}
                                                className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 transition hover:border-emerald-400 hover:text-emerald-500 dark:border-slate-600 dark:text-slate-300 dark:hover:border-emerald-400/70 dark:hover:text-emerald-200"
                                            >
                                                {isVisible ? (
                                                    <>
                                                        <EyeOff className="h-3.5 w-3.5" aria-hidden />
                                                        隐藏
                                                    </>
                                                ) : (
                                                    <>
                                                        <Eye className="h-3.5 w-3.5" aria-hidden />
                                                        显示
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(entry.id, entry.value)}
                                                className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 transition hover:border-emerald-400 hover:text-emerald-500 dark:border-slate-600 dark:text-slate-300 dark:hover:border-emerald-400/70 dark:hover:text-emerald-200"
                                            >
                                                {isCopied ? (
                                                    <>
                                                        <Check className="h-3.5 w-3.5" aria-hidden />
                                                        已复制
                                                    </>
                                                ) : (
                                                    <>
                                                        <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
                                                        复制
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(entry.id)}
                                                className="inline-flex items-center gap-1 rounded-full border border-rose-200/70 px-3 py-1 text-rose-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-rose-500/40 dark:text-rose-300 dark:hover:border-rose-400/70 dark:hover:text-rose-200"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                                删除
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>
            {toastMessage && (
                <div className="fixed right-6 bottom-6 z-50 max-w-xs rounded-2xl border border-emerald-400/70 bg-emerald-500/95 px-4 py-3 text-sm font-medium text-white shadow-xl shadow-emerald-500/30">
                    {toastMessage}
                </div>
            )}
        </>
    );
}
