'use client';

import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import type { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import type { Database } from '@/lib/supabase/types';

type SupabaseProviderProps = {
    children: React.ReactNode;
    initialSession: Session | null;
};

export function SupabaseProvider({ children, initialSession }: SupabaseProviderProps) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const [client] = useState(() => {
        if (!url || !key) {
            return null;
        }

        return createBrowserClient<Database>(url, key);
    });

    if (!url || !key || !client) {
        console.warn('Supabase env vars are missing. Check NEXT_PUBLIC_SUPABASE_URL/ANON_KEY.');
        return <>{children}</>;
    }

    return (
        <SessionContextProvider supabaseClient={client} initialSession={initialSession}>
            {children}
        </SessionContextProvider>
    );
}
