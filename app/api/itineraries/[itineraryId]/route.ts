import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createRouteClient } from '@/lib/supabase/route';
import type { PlannerResult } from '@/lib/types/planner';

export async function GET(_request: NextRequest, { params }: { params: { itineraryId?: string } }) {
    const itineraryId = params.itineraryId;

    if (!itineraryId) {
        return NextResponse.json({ error: 'Itinerary id is required.' }, { status: 400 });
    }

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
        .select('id, owner_id, destination, start_date, end_date, travelers, budget, draft_plan, preferences')
        .eq('id', itineraryId)
        .eq('owner_id', user.id)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const draftPlan = (data.draft_plan ?? {}) as Record<string, unknown>;
    const structuredPlan = draftPlan?.structured as PlannerResult | null | undefined;
    const rawPlan = typeof draftPlan?.raw === 'string' ? (draftPlan.raw as string) : null;
    const plan = isPlannerResult(structuredPlan) ? structuredPlan : null;

    const preferences = (data.preferences ?? {}) as Record<string, unknown>;
    const preferenceNotes = typeof preferences?.notes === 'string' ? preferences.notes : null;

    return NextResponse.json({
        data: {
            id: data.id,
            destination: data.destination,
            startDate: data.start_date,
            endDate: data.end_date,
            travelers: data.travelers,
            budget: data.budget == null ? null : Number(data.budget),
            preferences: preferenceNotes,
            plan,
            rawPlan,
        },
    });
}

export async function DELETE(_request: NextRequest, { params }: { params: { itineraryId?: string } }) {
    const itineraryId = params.itineraryId;

    if (!itineraryId) {
        return NextResponse.json({ error: 'Itinerary id is required.' }, { status: 400 });
    }

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

    const { error } = await supabase
        .from('itineraries')
        .delete()
        .eq('id', itineraryId)
        .eq('owner_id', user.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
}

function isPlannerResult(candidate: unknown): candidate is PlannerResult {
    if (!candidate || typeof candidate !== 'object') {
        return false;
    }

    const plan = candidate as PlannerResult;

    const isStringArray = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === 'string');

    if (typeof plan.overview !== 'string') {
        return false;
    }

    if (!Array.isArray(plan.dailyPlan)) {
        return false;
    }

    const validDay = plan.dailyPlan.every(
        (day) =>
            day &&
            typeof day === 'object' &&
            typeof day.title === 'string' &&
            typeof day.summary === 'string' &&
            isStringArray(day.activities) &&
            isStringArray(day.meals),
    );

    if (!validDay) {
        return false;
    }

    if (!isStringArray(plan.transportation) || !isStringArray(plan.accommodations) || !isStringArray(plan.restaurants)) {
        return false;
    }

    if (!Array.isArray(plan.estimatedBudget)) {
        return false;
    }

    const validBudget = plan.estimatedBudget.every(
        (entry) =>
            entry &&
            typeof entry === 'object' &&
            typeof entry.category === 'string' &&
            typeof entry.amount === 'number' &&
            typeof entry.currency === 'string',
    );

    if (!validBudget) {
        return false;
    }

    if (!isStringArray(plan.tips)) {
        return false;
    }

    return true;
}
