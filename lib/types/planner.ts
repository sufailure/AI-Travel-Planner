import type { Json } from '@/lib/supabase/types';

export type PlannerDayPlan = {
    title: string;
    summary: string;
    activities: string[];
    meals: string[];
};

export type PlannerBudgetEntry = {
    category: string;
    amount: number;
    currency: string;
    notes: string;
};

export type PlannerResult = {
    overview: string;
    dailyPlan: PlannerDayPlan[];
    transportation: string[];
    accommodations: string[];
    restaurants: string[];
    estimatedBudget: PlannerBudgetEntry[];
    tips: string[];
};

export type PlannerMapPoint = {
    id: string;
    name: string;
    label: string;
    source: string;
    lat: number;
    lng: number;
    address?: string | null;
    groupId?: string | null;
    groupLabel?: string | null;
};

export type PlannerGeoRequestItem = {
    id: string;
    query: string;
    label: string;
    source: string;
    groupId?: string | null;
    groupLabel?: string | null;
};

export type PlannerResultJson = Json;
