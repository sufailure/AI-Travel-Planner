import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createRouteClient } from '@/lib/supabase/route';

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
        })
        .select('id, title, destination, start_date, end_date, travelers, budget, updated_at')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
}
