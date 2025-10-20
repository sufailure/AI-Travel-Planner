import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createRouteClient } from '@/lib/supabase/route';
import type { PlannerResult } from '@/lib/types/planner';
import type { Json } from '@/lib/supabase/types';

export async function GET() {
    const supabase = createRouteClient();

    if (!supabase) {
        return NextResponse.json({ error: 'Supabase client not configured.' }, { status: 500 });
    }

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
        return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
        .from('itineraries')
        .select('id, title, destination, start_date, end_date, travelers, budget, updated_at')
        .eq('owner_id', user.id)
        .order('start_date', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
    const supabase = createRouteClient();

    if (!supabase) {
        return NextResponse.json({ error: 'Supabase client not configured.' }, { status: 500 });
    }

    const body = await request.json().catch(() => null);

    if (!body) {
        return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const {
        title,
        destination,
        startDate,
        endDate,
        travelers,
        budget,
        preferences,
        plan,
        rawPlan,
    } = body as Record<string, unknown>;

    if (typeof destination !== 'string' || destination.trim() === '') {
        return NextResponse.json({ error: 'Destination is required.' }, { status: 400 });
    }

    if (typeof startDate !== 'string' || typeof endDate !== 'string') {
        return NextResponse.json({ error: 'Start and end date are required.' }, { status: 400 });
    }

    const parsedTravelers = typeof travelers === 'number' ? travelers : Number(travelers ?? 1);
    const parsedBudget =
        typeof budget === 'number' || typeof budget === 'string'
            ? Number(budget) || null
            : null;

    const notes = typeof preferences === 'string' && preferences.trim() ? preferences.trim() : null;
    const structuredPlan = isPlannerResult(plan) ? plan : null;
    const rawPlanText = typeof rawPlan === 'string' && rawPlan.trim() ? rawPlan.trim() : null;
    const storedPreferences: Json | null = notes ? { notes } : null;
    const structuredPlanJson: Json | null = structuredPlan ? (structuredPlan as unknown as Json) : null;
    const draftPlan: Json | null = structuredPlanJson || rawPlanText
        ? {
            structured: structuredPlanJson,
            raw: rawPlanText,
        }
        : null;

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
        return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
        .from('itineraries')
        .insert({
            owner_id: user.id,
            title: typeof title === 'string' && title.trim() ? title.trim() : `${destination} 行程`,
            destination: destination.trim(),
            start_date: startDate,
            end_date: endDate,
            travelers: Number.isFinite(parsedTravelers) && parsedTravelers > 0 ? parsedTravelers : 1,
            budget: parsedBudget,
            preferences: storedPreferences,
            draft_plan: draftPlan,
        })
        .select('id, title, destination, start_date, end_date, travelers, budget, updated_at')
        .single();


    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
}

function isPlannerResult(candidate: unknown): candidate is PlannerResult {
    if (!candidate || typeof candidate !== 'object') {
        return false;
    }

    const plan = candidate as PlannerResult;
    if (typeof plan.overview !== 'string') {
        return false;
    }

    const isStringArray = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === 'string');

    if (!Array.isArray(plan.dailyPlan) || !plan.dailyPlan.every(isValidDailyPlan)) {
        return false;
    }

    if (!isStringArray(plan.transportation)) {
        return false;
    }

    if (!isStringArray(plan.accommodations)) {
        return false;
    }

    if (!isStringArray(plan.restaurants)) {
        return false;
    }

    if (!Array.isArray(plan.estimatedBudget) || !plan.estimatedBudget.every(isValidBudgetEntry)) {
        return false;
    }

    if (!isStringArray(plan.tips)) {
        return false;
    }

    return true;
}

function isValidDailyPlan(value: unknown) {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const day = value as PlannerResult['dailyPlan'][number];
    return (
        typeof day.title === 'string' &&
        typeof day.summary === 'string' &&
        Array.isArray(day.activities) &&
        day.activities.every((item) => typeof item === 'string') &&
        Array.isArray(day.meals) &&
        day.meals.every((item) => typeof item === 'string')
    );
}

function isValidBudgetEntry(value: unknown) {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const entry = value as PlannerResult['estimatedBudget'][number];
    return (
        typeof entry.category === 'string' &&
        typeof entry.amount === 'number' &&
        typeof entry.currency === 'string' &&
        typeof entry.notes === 'string'
    );
}
