import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createRouteClient } from '@/lib/supabase/route';
import type { Json } from '@/lib/supabase/types';

export async function POST(request: NextRequest) {
    const supabase = createRouteClient();

    if (!supabase) {
        return NextResponse.json({ error: 'Supabase client not configured.' }, { status: 500 });
    }

    const body = await request.json().catch(() => null);

    if (!body) {
        return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const { transcript, intent, payload } = body as Record<string, unknown>;

    if (typeof transcript !== 'string' || !transcript.trim()) {
        return NextResponse.json({ error: 'Transcript is required.' }, { status: 400 });
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

    const intentLabel = typeof intent === 'string' && intent.trim() ? intent.trim() : null;
    const payloadJson: Json | null = isJsonLike(payload) ? (payload as Json) : null;

    const { error } = await supabase.from('voice_logs').insert({
        owner_id: user.id,
        transcript: transcript.trim(),
        intent: intentLabel,
        payload: payloadJson,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
}

function isJsonLike(value: unknown): value is Json {
    if (value === null) {
        return true;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return true;
    }

    if (Array.isArray(value)) {
        return value.every((item) => isJsonLike(item));
    }

    if (typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).every((item) => isJsonLike(item));
    }

    return false;
}
