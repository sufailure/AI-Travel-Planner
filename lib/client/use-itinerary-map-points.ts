'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PlannerGeoRequestItem, PlannerMapPoint, PlannerResult } from '@/lib/types/planner';

export type UseItineraryMapPointsResult = {
    loading: boolean;
    error: string | null;
    points: PlannerMapPoint[];
};

export function useItineraryMapPoints(plan: PlannerResult | null, destination: string) {
    const [state, setState] = useState<UseItineraryMapPointsResult>({ loading: false, error: null, points: [] });

    const candidates = useMemo(() => {
        if (!plan) {
            return [] as PlannerGeoRequestItem[];
        }

        return collectPoiCandidates(plan);
    }, [plan]);

    useEffect(() => {
        if (!plan) {
            setState({ loading: false, error: null, points: [] });
            return;
        }

        if (candidates.length === 0) {
            setState({ loading: false, error: null, points: [] });
            return;
        }

        let aborted = false;
        setState((prev) => ({ ...prev, loading: true, error: null }));

        const fetchPoints = async () => {
            try {
                const response = await fetch('/api/maps/geocode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: candidates, city: destination || undefined }),
                });

                if (!response.ok) {
                    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                    throw new Error(payload?.error ?? '无法获取地点坐标。');
                }

                const payload = (await response.json()) as {
                    data: Array<{
                        id: string;
                        name: string;
                        query: string;
                        label?: string;
                        source?: string;
                        address?: string | null;
                        location: { lat: number; lng: number };
                    }>;
                };

                const points: PlannerMapPoint[] = payload.data.map((item) => ({
                    id: item.id,
                    name: item.name || item.query,
                    label: item.label ?? item.query,
                    source: item.source ?? '行程推荐',
                    lat: item.location.lat,
                    lng: item.location.lng,
                    address: item.address ?? null,
                }));

                if (!aborted) {
                    setState({ loading: false, error: null, points });
                }
            } catch (error) {
                if (aborted) {
                    return;
                }
                const message = error instanceof Error ? error.message : '无法加载地图数据。';
                setState({ loading: false, error: message, points: [] });
            }
        };

        void fetchPoints();

        return () => {
            aborted = true;
        };
    }, [plan, candidates, destination]);

    return state;
}

function collectPoiCandidates(plan: PlannerResult): PlannerGeoRequestItem[] {
    const entries: PlannerGeoRequestItem[] = [];
    const seen = new Set<string>();

    const push = (raw: string, source: string) => {
        const query = normalisePoiName(raw);
        if (!query) {
            return;
        }
        const key = `${source}:${query.toLowerCase()}`;
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        entries.push({
            id: `poi-${entries.length + 1}`,
            query,
            label: raw.trim(),
            source,
        });
    };

    for (const accommodation of plan.accommodations ?? []) {
        push(accommodation, '住宿推荐');
    }

    for (const restaurant of plan.restaurants ?? []) {
        push(restaurant, '餐饮推荐');
    }

    for (const tip of plan.transportation ?? []) {
        push(tip, '交通建议');
    }

    for (const day of plan.dailyPlan ?? []) {
        for (const activity of day.activities ?? []) {
            push(activity, day.title || '每日行程');
        }
        for (const meal of day.meals ?? []) {
            push(meal, `${day.title || '每日行程'} · 餐饮`);
        }
    }

    return entries.slice(0, 20);
}

function normalisePoiName(raw: string) {
    if (!raw) {
        return '';
    }

    return raw
        .replace(/^[\d\-•\s\.]+/, '')
        .replace(/（.*?）/g, '')
        .replace(/\(.*?\)/g, '')
        .split(/[，。、；;·]/)[0]
        ?.trim() ?? '';
}
