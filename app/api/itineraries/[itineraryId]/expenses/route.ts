import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createRouteClient } from '@/lib/supabase/route';
import type { Database } from '@/lib/supabase/types';

type ExpenseRow = Database['public']['Tables']['expenses']['Row'];
type ExpenseEntryRecord = Pick<
    Database['public']['Tables']['expense_entries']['Row'],
    'id' | 'category' | 'amount' | 'source' | 'notes' | 'incurred_on' | 'created_at'
>;
type RouteClient = NonNullable<ReturnType<typeof createRouteClient>>;

export type ExpenseResponse = {
    expenseId: string;
    currency: string;
    totals: {
        plan: number;
        actual: number;
    };
    entries: Array<{
        id: string;
        category: string;
        amount: number;
        source: Database['public']['Enums']['expense_source'];
        notes: string | null;
        incurredOn: string | null;
        createdAt: string;
    }>;
};

const DEFAULT_CURRENCY = 'CNY';

export async function GET(_request: NextRequest, { params }: { params: { itineraryId?: string } }) {
    const itineraryId = params.itineraryId;

    if (!itineraryId) {
        return NextResponse.json({ error: '缺少行程 ID。' }, { status: 400 });
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

    const ownsItinerary = await verifyItineraryOwnership(supabase, itineraryId, user.id);

    if (!ownsItinerary) {
        return NextResponse.json({ error: '未找到对应行程或无权访问。' }, { status: 404 });
    }

    const expense = await ensureExpenseSummary(supabase, itineraryId, user.id);

    if (!expense) {
        return NextResponse.json({ error: '无法创建或查询预算记录。' }, { status: 500 });
    }

    const entries = await fetchEntries(supabase, expense.id);
    const totals = computeTotals(entries);

    if (!(await updateStoredTotals(supabase, expense.id, totals))) {
        return NextResponse.json({ error: '无法刷新预算汇总。' }, { status: 500 });
    }

    const payload: ExpenseResponse = {
        expenseId: expense.id,
        currency: expense.currency ?? DEFAULT_CURRENCY,
        totals,
        entries: mapEntries(entries),
    };

    return NextResponse.json(payload);
}

export async function POST(request: NextRequest, { params }: { params: { itineraryId?: string } }) {
    const itineraryId = params.itineraryId;

    if (!itineraryId) {
        return NextResponse.json({ error: '缺少行程 ID。' }, { status: 400 });
    }

    const supabaseClient = createRouteClient();

    if (!supabaseClient) {
        return NextResponse.json({ error: 'Supabase 未配置。' }, { status: 500 });
    }
    const supabase: RouteClient = supabaseClient;

    const body = (await request.json().catch(() => null)) as
        | {
            category?: unknown;
            amount?: unknown;
            source?: unknown;
            notes?: unknown;
            incurredOn?: unknown;
        }
        | null;

    if (!body) {
        return NextResponse.json({ error: '请求体格式错误。' }, { status: 400 });
    }

    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount ?? NaN);
    const source = body.source === 'actual' ? 'actual' : body.source === 'plan' ? 'plan' : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    const incurredOn = typeof body.incurredOn === 'string' && body.incurredOn.trim() ? body.incurredOn : null;

    if (!category) {
        return NextResponse.json({ error: '请填写费用类别。' }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: '请填写大于 0 的金额。' }, { status: 400 });
    }

    if (!source) {
        return NextResponse.json({ error: '请选择记录类型（计划或实际）。' }, { status: 400 });
    }

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

    const ownsItinerary = await verifyItineraryOwnership(supabase, itineraryId, user.id);

    if (!ownsItinerary) {
        return NextResponse.json({ error: '未找到对应行程或无权访问。' }, { status: 404 });
    }

    const expense = await ensureExpenseSummary(supabase, itineraryId, user.id);

    if (!expense) {
        return NextResponse.json({ error: '无法创建或查询预算记录。' }, { status: 500 });
    }

    const { error: insertError, data: inserted } = await supabase
        .from('expense_entries')
        .insert({
            expense_id: expense.id,
            category,
            amount,
            source,
            notes,
            incurred_on: incurredOn,
        })
        .select('id, category, amount, source, notes, incurred_on, created_at')
        .single();

    if (insertError || !inserted) {
        return NextResponse.json({ error: insertError?.message ?? '新增费用失败。' }, { status: 500 });
    }

    const entries = await fetchEntries(supabase, expense.id);
    const totals = computeTotals(entries);

    if (!(await updateStoredTotals(supabase, expense.id, totals))) {
        return NextResponse.json({ error: '无法刷新预算汇总。' }, { status: 500 });
    }

    const payload: ExpenseResponse = {
        expenseId: expense.id,
        currency: expense.currency ?? DEFAULT_CURRENCY,
        totals,
        entries: mapEntries(entries),
    };

    return NextResponse.json(payload, { status: 201 });
}

async function verifyItineraryOwnership(supabase: RouteClient, itineraryId: string, ownerId: string) {
    const { data } = await supabase
        .from('itineraries')
        .select('id')
        .eq('id', itineraryId)
        .eq('owner_id', ownerId)
        .maybeSingle();

    return Boolean(data?.id);
}

async function ensureExpenseSummary(supabase: RouteClient, itineraryId: string, ownerId: string) {
    const { data: existing } = await supabase
        .from('expenses')
        .select('id, currency')
        .eq('itinerary_id', itineraryId)
        .eq('owner_id', ownerId)
        .maybeSingle();

    if (existing) {
        return existing;
    }

    const { data: inserted, error } = await supabase
        .from('expenses')
        .insert({
            itinerary_id: itineraryId,
            owner_id: ownerId,
            currency: DEFAULT_CURRENCY,
        })
        .select('id, currency')
        .single();

    if (error) {
        console.error('Failed to create expense summary:', error);
        return null;
    }

    return inserted;
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

async function updateStoredTotals(supabase: RouteClient, expenseId: string, totals: { plan: number; actual: number }) {
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
