import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ExpenseResponse } from '@/app/api/itineraries/[itineraryId]/expenses/route';
import type { Database } from '@/lib/supabase/types';

type ExpenseSource = Database['public']['Enums']['expense_source'];

type ExpenseInput = {
    category: string;
    amount: number;
    source: ExpenseSource;
    notes?: string | null;
    incurredOn?: string | null;
};

type UseExpenseEntriesState = {
    data: ExpenseResponse | null;
    loading: boolean;
    error: string | null;
};

type UseExpenseEntriesReturn = UseExpenseEntriesState & {
    refresh: () => Promise<void>;
    createEntry: (input: ExpenseInput) => Promise<boolean>;
    deleteEntry: (entryId: string) => Promise<boolean>;
};

const INITIAL_STATE: UseExpenseEntriesState = {
    data: null,
    loading: false,
    error: null,
};

export function useExpenseEntries(itineraryId?: string): UseExpenseEntriesReturn {
    const [state, setState] = useState<UseExpenseEntriesState>(INITIAL_STATE);

    const load = useCallback(async () => {
        if (!itineraryId) {
            setState(INITIAL_STATE);
            return;
        }

        setState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const response = await fetch(`/api/itineraries/${itineraryId}/expenses`);

            if (!response.ok) {
                const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                throw new Error(payload?.error ?? '无法加载预算信息。');
            }

            const payload = (await response.json()) as ExpenseResponse;
            setState({ data: payload, loading: false, error: null });
        } catch (error) {
            const message = error instanceof Error ? error.message : '加载预算信息时出现未知错误。';
            setState({ data: null, loading: false, error: message });
        }
    }, [itineraryId]);

    useEffect(() => {
        load();
    }, [load]);

    const refresh = useCallback(async () => {
        await load();
    }, [load]);

    const createEntry = useCallback(
        async (input: ExpenseInput) => {
            if (!itineraryId) {
                setState((prev) => ({ ...prev, error: '缺少行程 ID。' }));
                return false;
            }

            setState((prev) => ({ ...prev, loading: true, error: null }));

            try {
                const response = await fetch(`/api/itineraries/${itineraryId}/expenses`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(input),
                });

                if (!response.ok) {
                    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                    throw new Error(payload?.error ?? '新增费用失败。');
                }

                const payload = (await response.json()) as ExpenseResponse;
                setState({ data: payload, loading: false, error: null });
                return true;
            } catch (error) {
                const message = error instanceof Error ? error.message : '新增费用时出现未知错误。';
                setState((prev) => ({ ...prev, loading: false, error: message }));
                return false;
            }
        },
        [itineraryId],
    );

    const deleteEntry = useCallback(async (entryId: string) => {
        if (!entryId) {
            setState((prev) => ({ ...prev, error: '缺少费用记录 ID。' }));
            return false;
        }

        setState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const response = await fetch(`/api/expense-entries/${entryId}`, { method: 'DELETE' });

            if (!response.ok) {
                const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                throw new Error(payload?.error ?? '删除费用失败。');
            }

            const payload = (await response.json()) as ExpenseResponse;
            setState({ data: payload, loading: false, error: null });
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : '删除费用时出现未知错误。';
            setState((prev) => ({ ...prev, loading: false, error: message }));
            return false;
        }
    }, []);

    return useMemo(
        () => ({
            data: state.data,
            loading: state.loading,
            error: state.error,
            refresh,
            createEntry,
            deleteEntry,
        }),
        [state.data, state.error, state.loading, refresh, createEntry, deleteEntry],
    );
}
