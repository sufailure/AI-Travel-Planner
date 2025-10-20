import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createRouteClient } from '@/lib/supabase/route';
import { ensureUserProfile } from '@/lib/supabase/queries';
import {
    normalizeUserPreferences,
    preferencesToJson,
    sanitizeUserPreferences,
} from '@/lib/types/preferences';

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

    const profile = await ensureUserProfile(supabase, user);

    if (!profile) {
        return NextResponse.json({ error: 'Profile is missing.' }, { status: 500 });
    }

    const normalized = sanitizeUserPreferences(normalizeUserPreferences(profile.preferences));

    return NextResponse.json({ data: normalized ?? null }, { status: 200 });
}

export async function PUT(request: NextRequest) {
    const supabase = createRouteClient();

    if (!supabase) {
        return NextResponse.json({ error: 'Supabase client not configured.' }, { status: 500 });
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
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

    const profile = await ensureUserProfile(supabase, user);

    if (!profile) {
        return NextResponse.json({ error: 'Profile is missing.' }, { status: 500 });
    }

    const normalized = sanitizeUserPreferences(normalizeUserPreferences(body));
    const serialized = preferencesToJson(normalized);

    const { data, error } = await supabase
        .from('profiles')
        .update({ preferences: serialized })
        .eq('id', user.id)
        .select('preferences')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const updated = sanitizeUserPreferences(normalizeUserPreferences(data?.preferences ?? null));

    return NextResponse.json({ data: updated ?? null }, { status: 200 });
}
