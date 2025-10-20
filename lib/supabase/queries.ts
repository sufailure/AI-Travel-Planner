import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export type Itinerary = Database['public']['Tables']['itineraries']['Row'];
export type Profile = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'display_name'>;

export async function ensureUserProfile(
    supabase: SupabaseClient<Database> | null,
    user: User,
): Promise<Profile | null> {
    if (!supabase) {
        return null;
    }

    const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', user.id)
        .maybeSingle();

    if (existingProfile) {
        return existingProfile;
    }

    const defaultName =
        (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
        (typeof user.email === 'string' && user.email?.split('@')[0]) ||
        '旅行者';

    const { data: insertedProfile } = await supabase
        .from('profiles')
        .insert({
            id: user.id,
            display_name: defaultName,
        })
        .select('id, display_name')
        .single();

    return insertedProfile;
}

export async function getUserItineraries(
    supabase: SupabaseClient<Database> | null,
    ownerId: string,
): Promise<Itinerary[]> {
    if (!supabase) {
        return [];
    }

    const { data } = await supabase
        .from('itineraries')
        .select('id, title, destination, start_date, end_date, travelers, budget, updated_at')
        .eq('owner_id', ownerId)
        .order('start_date', { ascending: true });

    return (data ?? []) as Itinerary[];
}
