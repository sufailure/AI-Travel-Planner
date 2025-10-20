import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

export function createServerClient(): SupabaseClient<Database> | null {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.warn('Supabase env vars are missing. Check NEXT_PUBLIC_SUPABASE_URL/ANON_KEY.');
        return null;
    }

    const cookieStore = cookies();
    return createServerComponentClient<Database>({
        cookies: () => cookieStore,
        supabaseUrl,
        supabaseKey,
    });
}
