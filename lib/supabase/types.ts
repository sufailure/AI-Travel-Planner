export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type Database = {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    display_name: string | null;
                    avatar_url: string | null;
                    home_airport: string | null;
                    preferences: Json | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    display_name?: string | null;
                    avatar_url?: string | null;
                    home_airport?: string | null;
                    preferences?: Json | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    display_name?: string | null;
                    avatar_url?: string | null;
                    home_airport?: string | null;
                    preferences?: Json | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            itineraries: {
                Row: {
                    id: string;
                    owner_id: string;
                    title: string;
                    destination: string;
                    start_date: string;
                    end_date: string;
                    travelers: number;
                    budget: number | null;
                    preferences: Json | null;
                    draft_plan: Json | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    owner_id: string;
                    title: string;
                    destination: string;
                    start_date: string;
                    end_date: string;
                    travelers?: number;
                    budget?: number | null;
                    preferences?: Json | null;
                    draft_plan?: Json | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    title?: string;
                    destination?: string;
                    start_date?: string;
                    end_date?: string;
                    travelers?: number;
                    budget?: number | null;
                    preferences?: Json | null;
                    draft_plan?: Json | null;
                    updated_at?: string;
                };
            };
            itinerary_days: {
                Row: {
                    id: string;
                    itinerary_id: string;
                    day_index: number;
                    date: string;
                    summary: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    itinerary_id: string;
                    day_index: number;
                    date: string;
                    summary?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    day_index?: number;
                    date?: string;
                    summary?: string | null;
                    updated_at?: string;
                };
            };
            itinerary_items: {
                Row: {
                    id: string;
                    day_id: string;
                    item_type: Database['public']['Enums']['activity_kind'];
                    title: string;
                    description: string | null;
                    location_name: string | null;
                    location_lat: number | null;
                    location_lng: number | null;
                    start_time: string | null;
                    end_time: string | null;
                    metadata: Json | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    day_id: string;
                    item_type: Database['public']['Enums']['activity_kind'];
                    title: string;
                    description?: string | null;
                    location_name?: string | null;
                    location_lat?: number | null;
                    location_lng?: number | null;
                    start_time?: string | null;
                    end_time?: string | null;
                    metadata?: Json | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    item_type?: Database['public']['Enums']['activity_kind'];
                    title?: string;
                    description?: string | null;
                    location_name?: string | null;
                    location_lat?: number | null;
                    location_lng?: number | null;
                    start_time?: string | null;
                    end_time?: string | null;
                    metadata?: Json | null;
                    updated_at?: string;
                };
            };
            expenses: {
                Row: {
                    id: string;
                    itinerary_id: string;
                    owner_id: string;
                    currency: string;
                    planned_total: number | null;
                    actual_total: number | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    itinerary_id: string;
                    owner_id: string;
                    currency?: string;
                    planned_total?: number | null;
                    actual_total?: number | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    currency?: string;
                    planned_total?: number | null;
                    actual_total?: number | null;
                    updated_at?: string;
                };
            };
            expense_entries: {
                Row: {
                    id: string;
                    expense_id: string;
                    category: string;
                    amount: number;
                    notes: string | null;
                    incurred_on: string | null;
                    source: Database['public']['Enums']['expense_source'];
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    expense_id: string;
                    category: string;
                    amount: number;
                    notes?: string | null;
                    incurred_on?: string | null;
                    source?: Database['public']['Enums']['expense_source'];
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    category?: string;
                    amount?: number;
                    notes?: string | null;
                    incurred_on?: string | null;
                    source?: Database['public']['Enums']['expense_source'];
                    updated_at?: string;
                };
            };
            voice_logs: {
                Row: {
                    id: string;
                    owner_id: string;
                    transcript: string;
                    intent: string | null;
                    payload: Json | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    owner_id: string;
                    transcript: string;
                    intent?: string | null;
                    payload?: Json | null;
                    created_at?: string;
                };
                Update: {
                    transcript?: string;
                    intent?: string | null;
                    payload?: Json | null;
                };
            };
        };
        Views: {};
        Functions: {};
        Enums: {
            activity_kind: 'transport' | 'lodging' | 'activity' | 'meal' | 'note';
            expense_source: 'plan' | 'actual';
        };
        CompositeTypes: {};
    };
};
