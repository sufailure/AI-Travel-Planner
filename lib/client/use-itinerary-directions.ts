'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PlannerMapPoint } from '@/lib/types/planner';

export type DirectionMode = 'walking' | 'driving';

export type DirectionStep = {
    instruction: string;
    distance: number;
    duration: number;
};

export type DirectionResult = {
    distance: number;
    duration: number;
    mode: DirectionMode;
    polyline: Array<{ lat: number; lng: number }>;
    steps: DirectionStep[];
};

export type UseItineraryDirectionsState = {
    loading: boolean;
    error: string | null;
    result: DirectionResult | null;
};

export function useItineraryDirections(
    points: PlannerMapPoint[],
    startPointId: string | null,
    endPointId: string | null,
    mode: DirectionMode,
): UseItineraryDirectionsState & {
    canRequest: boolean;
    request: () => void;
} {
    const [state, setState] = useState<UseItineraryDirectionsState>({ loading: false, error: null, result: null });
    const [nonce, setNonce] = useState(0);

    const startPoint = useMemo(() => points.find((point) => point.id === startPointId) ?? null, [points, startPointId]);
    const endPoint = useMemo(() => points.find((point) => point.id === endPointId) ?? null, [points, endPointId]);

    useEffect(() => {
        setState({ loading: false, error: null, result: null });
    }, [startPointId, endPointId, mode]);

    useEffect(() => {
        if (!startPoint || !endPoint || startPoint.id === endPoint.id) {
            return;
        }

        if (nonce === 0) {
            return;
        }

        let aborted = false;
        setState({ loading: true, error: null, result: null });

        const fetchDirections = async () => {
            try {
                const response = await fetch('/api/maps/directions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        origin: { lat: startPoint.lat, lng: startPoint.lng },
                        destination: { lat: endPoint.lat, lng: endPoint.lng },
                        mode,
                    }),
                });

                if (!response.ok) {
                    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                    throw new Error(payload?.error ?? '无法获取导航路线。');
                }

                const payload = (await response.json()) as { data: DirectionResult };

                if (!aborted) {
                    setState({ loading: false, error: null, result: payload.data });
                }
            } catch (error) {
                if (aborted) {
                    return;
                }
                const message = error instanceof Error ? error.message : '导航请求失败。';
                setState({ loading: false, error: message, result: null });
            }
        };

        void fetchDirections();

        return () => {
            aborted = true;
        };
    }, [nonce, startPoint, endPoint, mode]);

    const request = useCallback(() => {
        if (!startPoint || !endPoint || startPoint.id === endPoint.id) {
            return;
        }
        setNonce((value) => value + 1);
    }, [startPoint, endPoint]);

    const canRequest = Boolean(startPoint && endPoint && startPoint.id !== endPoint.id);

    return {
        ...state,
        canRequest,
        request,
    };
}
