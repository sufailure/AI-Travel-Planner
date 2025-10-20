import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { ExpenseResponse } from '@/app/api/itineraries/[itineraryId]/expenses/route';
import { createRouteClient } from '@/lib/supabase/route';
import type { Database } from '@/lib/supabase/types';

type RouteClient = NonNullable<ReturnType<typeof createRouteClient>>;
type ExpenseEntryRecord = Pick<
    Database['public']['Tables']['expense_entries']['Row'],
    'id' | 'category' | 'amount' | 'source' | 'notes' | 'incurred_on' | 'created_at'
>;

export async function DELETE(_request: NextRequest, { params }: { params: { entryId?: string } }) {
    const entryId = params.entryId;

    if (!entryId) {
        return NextResponse.json({ error: '缺少费用记录 ID。' }, { status: 400 });
    }

    const supabaseClient = createRouteClient();

    if (!supabaseClient) {
        return NextResponse.json({ error: 'Supabase 未配置。' }, { status: 500 });
    }
    const supabase: RouteClient = supabaseClient;

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
        return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    if (!user) {
        return NextResponse.json({ error: '未登录或会话已过期。' }, { status: 401 });
    }

    const { data: entry } = await supabase
        .from('expense_entries')
        .select('id, expense_id')
        .eq('id', entryId)
        .maybeSingle();

    if (!entry) {
        return NextResponse.json({ error: '未找到费用记录。' }, { status: 404 });
    }

    const { data: expense } = await supabase
        .from('expenses')
        .select('id, owner_id, currency')
        .eq('id', entry.expense_id)
        .maybeSingle();

    if (!expense || expense.owner_id !== user.id) {
        return NextResponse.json({ error: '未找到对应预算记录或无权访问。' }, { status: 404 });
    }

    const { error: deleteError } = await supabase.from('expense_entries').delete().eq('id', entryId);

    if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const entries = await fetchEntries(supabase, expense.id);
    const totals = computeTotals(entries);

    if (!(await updateStoredTotals(supabase, expense.id, totals))) {
        return NextResponse.json({ error: '无法刷新预算汇总。' }, { status: 500 });
    }

    const payload: ExpenseResponse = {
        expenseId: expense.id,
        currency: expense.currency,
        totals,
        entries: mapEntries(entries),
    };

    return NextResponse.json(payload);
}

async function fetchEntries(supabase: RouteClient, expenseId: string): Promise<ExpenseEntryRecord[]> {
    const { data } = await supabase
        .from('expense_entries')
        .select('id, category, amount, source, notes, incurred_on, created_at')
        .eq('expense_id', expenseId)
        .order('created_at', { ascending: false })
        .returns<ExpenseEntryRecord[]>();

    return data ?? [];
}

function computeTotals(entries: ExpenseEntryRecord[]) {
    return entries.reduce(
        (acc, entry) => {
            if (entry.source === 'plan') {
                acc.plan += Number(entry.amount) || 0;
            } else if (entry.source === 'actual') {
                acc.actual += Number(entry.amount) || 0;
            }
            return acc;
        },
        { plan: 0, actual: 0 },
    );
}

async function updateStoredTotals(
    supabase: RouteClient,
    expenseId: string,
    totals: { plan: number; actual: number },
) {
    const { error } = await supabase
        .from('expenses')
        .update({ planned_total: totals.plan, actual_total: totals.actual })
        .eq('id', expenseId);

    if (error) {
        console.error('Failed to update expense totals:', error);
        return false;
    }

    return true;
}

function mapEntries(entries: ExpenseEntryRecord[]) {
    return entries.map((entry) => ({
        id: entry.id,
        category: entry.category,
        amount: Number(entry.amount) || 0,
        source: entry.source,
        notes: entry.notes,
        incurredOn: entry.incurred_on,
        createdAt: entry.created_at,
    }));
}
