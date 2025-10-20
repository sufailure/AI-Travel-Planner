import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createRouteClient } from '@/lib/supabase/route';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const redirectTo = requestUrl.searchParams.get('redirect_to') ?? '/';

    const supabase = createRouteClient();

    if (!supabase) {
        return NextResponse.redirect(requestUrl.origin.concat(redirectTo));
    }

    if (code) {
        await supabase.auth.exchangeCodeForSession(code);
    }

    return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
}
