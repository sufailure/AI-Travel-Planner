import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createRouteClient } from '@/lib/supabase/route';

export async function POST(request: NextRequest) {
    const supabase = createRouteClient();

    if (supabase) {
        await supabase.auth.signOut();
    }

    const requestUrl = new URL(request.url);
    return NextResponse.redirect(new URL('/', requestUrl.origin));
}
