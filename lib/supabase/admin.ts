import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export function createAdminClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables.');
    }

    return createClient<Database>(url, key, {
        auth: {
            persistSession: false,
        },
    });
}
