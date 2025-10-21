'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Navigation, Route as RouteIcon } from 'lucide-react';
import { useItineraryMapPoints } from '@/lib/client/use-itinerary-map-points';
import { useItineraryDirections } from '@/lib/client/use-itinerary-directions';
import type { PlannerMapPoint, PlannerResult } from '@/lib/types/planner';

const AMAP_SCRIPT_BASE = 'https://webapi.amap.com/maps';
const AMAP_VERSION = '2.0';

type ItineraryMapProps = {
    plan: PlannerResult;
    destination: string;
};

type AMapNamespace = any;

declare global {
    interface Window {
        AMap?: AMapNamespace;
        _AMapSecurityConfig?: {
            securityJsCode?: string;
        };
    }
}

let amapLoader: Promise<AMapNamespace> | null = null;

function loadAmapJs(key: string, securityJsCode?: string) {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('仅限浏览器环境加载地图。'));
    }

    if (window.AMap) {
        return Promise.resolve(window.AMap);
    }

    if (amapLoader) {
        return amapLoader;
    }

    amapLoader = new Promise<AMapNamespace>((resolve, reject) => {
        if (securityJsCode) {
            window._AMapSecurityConfig = {
                ...(window._AMapSecurityConfig ?? {}),
                securityJsCode,
            };
        }

        const script = document.createElement('script');
        script.src = `${AMAP_SCRIPT_BASE}?v=${AMAP_VERSION}&key=${encodeURIComponent(key)}&plugin=AMap.ToolBar`;
        script.async = true;
        script.onerror = () => reject(new Error('地图脚本加载失败，请检查网络或密钥配置。'));
        script.onload = () => {
            if (window.AMap) {
                resolve(window.AMap);
            } else {
                reject(new Error('地图脚本加载后未能找到 AMap 对象。'));
            }
        };
        document.head.appendChild(script);
    });

    return amapLoader;
}

export function ItineraryMap({ plan, destination }: ItineraryMapProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    const amapRef = useRef<AMapNamespace | null>(null);
    const [mapError, setMapError] = useState<string | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);

    const { loading, error, points } = useItineraryMapPoints(plan, destination);

    const jsKey = process.env.NEXT_PUBLIC_AMAP_JS_KEY;
    const securityJsCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE;

    const [startPointId, setStartPointId] = useState<string | null>(null);
    const [endPointId, setEndPointId] = useState<string | null>(null);
    const [mode, setMode] = useState<'walking' | 'driving'>('walking');

    const selectedStart = useMemo(
        () => points.find((point) => point.id === startPointId) ?? null,
        [points, startPointId],
    );
    const selectedEnd = useMemo(
        () => points.find((point) => point.id === endPointId) ?? null,
        [points, endPointId],
    );

    const {
        loading: routeLoading,
        error: routeError,
        result: routeResult,
        canRequest,
        request: requestRoute,
    } = useItineraryDirections(points, startPointId, endPointId, mode);

    const markersRef = useRef<Array<{ id: string; marker: any }>>([]);
    const routePolylineRef = useRef<any>(null);

    const groupedPoints = useMemo(() => {
        if (!points.length) {
            return [] as Array<{ key: string; label: string; points: PlannerMapPoint[] }>;
        }

        const map = new Map<string, { key: string; label: string; points: PlannerMapPoint[] }>();

        points.forEach((point) => {
            const label = point.groupLabel || point.source || '行程推荐';
            const key = point.groupId || `label-${label}`;
            if (!map.has(key)) {
                map.set(key, { key, label, points: [] });
            }
            map.get(key)!.points.push(point);
        });

        return Array.from(map.values());
    }, [points]);

    useEffect(() => {
        if (startPointId && !points.some((point) => point.id === startPointId)) {
            setStartPointId(null);
        }
        if (endPointId && !points.some((point) => point.id === endPointId)) {
            setEndPointId(null);
        }
    }, [points, startPointId, endPointId]);

    const handleSetStart = useCallback((pointId: string) => {
        setStartPointId((current) => (current === pointId ? null : pointId));
        setEndPointId((current) => (current === pointId ? null : current));
    }, []);

    const handleSetEnd = useCallback((pointId: string) => {
        setEndPointId((current) => (current === pointId ? null : pointId));
        setStartPointId((current) => (current === pointId ? null : current));
    }, []);

    const handleMarkerClick = useCallback(
        (pointId: string) => {
            if (!startPointId) {
                handleSetStart(pointId);
                return;
            }
            if (!endPointId) {
                handleSetEnd(pointId);
                return;
            }

            if (startPointId === pointId) {
                handleSetStart(pointId);
                return;
            }

            if (endPointId === pointId) {
                handleSetEnd(pointId);
                return;
            }

            handleSetStart(pointId);
        },
        [startPointId, endPointId, handleSetStart, handleSetEnd],
    );

    const handleModeChange = useCallback((nextMode: 'walking' | 'driving') => {
        setMode(nextMode);
    }, []);

    const handleGenerateRoute = useCallback(() => {
        if (canRequest) {
            requestRoute();
        }
    }, [canRequest, requestRoute]);

    const externalNavigationLink = useMemo(() => {
        if (!selectedStart || !selectedEnd) {
            return null;
        }
        const modeParam = mode === 'driving' ? 'car' : 'walk';
        const fromLabel = encodeURIComponent(selectedStart.label);
        const toLabel = encodeURIComponent(selectedEnd.label);
        return `https://uri.amap.com/navigation?from=${selectedStart.lng},${selectedStart.lat},${fromLabel}&to=${selectedEnd.lng},${selectedEnd.lat},${toLabel}&mode=${modeParam}`;
    }, [selectedStart, selectedEnd, mode]);

    const routeDistanceLabel = useMemo(
        () => (routeResult ? formatDistance(routeResult.distance) : null),
        [routeResult],
    );
    const routeDurationLabel = useMemo(
        () => (routeResult ? formatDuration(routeResult.duration) : null),
        [routeResult],
    );

    useEffect(() => {
        if (!jsKey) {
            setMapError('尚未配置 NEXT_PUBLIC_AMAP_JS_KEY，无法加载地图。');
            return;
        }

        let destroyed = false;

        const initialize = async () => {
            try {
                const AMap = await loadAmapJs(jsKey, securityJsCode);
                if (destroyed || !containerRef.current) {
                    return;
                }

                amapRef.current = AMap;
                mapRef.current = new AMap.Map(containerRef.current, {
                    viewMode: '3D',
                    zoom: 11,
                    resizeEnable: true,
                });

                if (AMap.ToolBar) {
                    mapRef.current.addControl(new AMap.ToolBar());
                }

                setIsMapReady(true);
            } catch (error) {
                const message = error instanceof Error ? error.message : '地图初始化失败。';
                setMapError(message);
            }
        };

        void initialize();

        return () => {
            destroyed = true;
            if (mapRef.current) {
                mapRef.current.destroy();
                mapRef.current = null;
            }
        };
    }, [jsKey, securityJsCode]);

    useEffect(() => {
        if (!isMapReady || !amapRef.current || !mapRef.current) {
            return;
        }

        const AMap = amapRef.current;
        const map = mapRef.current;

        markersRef.current.forEach((entry) => entry.marker.setMap(null));
        markersRef.current = [];

        if (!points.length) {
            return;
        }

        const markerEntries = points.map((point) => {
            const marker = new AMap.Marker({
                position: [point.lng, point.lat],
                title: point.label,
            });
            marker.on('click', () => handleMarkerClick(point.id));
            return { id: point.id, marker };
        });

        markerEntries.forEach((entry) => map.add(entry.marker));
        markersRef.current = markerEntries;

        map.setFitView(
            markerEntries.map((entry) => entry.marker),
            true,
            [60, 60, 60, 60],
        );

        return () => {
            markerEntries.forEach((entry) => entry.marker.setMap(null));
        };
    }, [isMapReady, points, handleMarkerClick]);

    useEffect(() => {
        if (!amapRef.current) {
            return;
        }

        markersRef.current.forEach((entry) => {
            const { marker, id } = entry;
            if (id === startPointId) {
                marker.setLabel({ content: '起点', direction: 'top' });
                marker.setzIndex(120);
            } else if (id === endPointId) {
                marker.setLabel({ content: '终点', direction: 'top' });
                marker.setzIndex(115);
            } else {
                marker.setLabel(null);
                marker.setzIndex(100);
            }
        });
    }, [startPointId, endPointId]);

    useEffect(() => {
        if (!isMapReady || !amapRef.current || !mapRef.current) {
            if (routePolylineRef.current) {
                routePolylineRef.current.setMap(null);
                routePolylineRef.current = null;
            }
            return;
        }

        const AMap = amapRef.current;
        const map = mapRef.current;

        if (routePolylineRef.current) {
            routePolylineRef.current.setMap(null);
            routePolylineRef.current = null;
        }

        if (!routeResult?.polyline?.length) {
            return;
        }

        const path = routeResult.polyline.map((point) => [point.lng, point.lat]);
        if (path.length < 2) {
            return;
        }

        routePolylineRef.current = new AMap.Polyline({
            path,
            strokeColor: '#10b981',
            strokeWeight: 6,
            strokeOpacity: 0.85,
        });

        map.add(routePolylineRef.current);

        const overlays = markersRef.current.map((entry) => entry.marker);
        map.setFitView([...overlays, routePolylineRef.current], false, [80, 80, 80, 80]);

        return () => {
            if (routePolylineRef.current) {
                routePolylineRef.current.setMap(null);
                routePolylineRef.current = null;
            }
        };
    }, [routeResult, isMapReady]);

    return (
        <section className="mt-6 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-lg shadow-emerald-200/20 dark:border-slate-700/60 dark:bg-slate-900/60 dark:shadow-emerald-500/10">
            <header className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <MapPin className="h-4 w-4 text-emerald-500 dark:text-emerald-300" aria-hidden />
                    行程地图
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                    {destination ? `目的地：${destination}` : '目的地将用于自动定位'}
                </span>
            </header>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/60 bg-slate-100/60 dark:border-slate-700/50 dark:bg-slate-800/40">
                {mapError ? (
                    <p className="p-6 text-sm text-rose-500 dark:text-rose-300">{mapError}</p>
                ) : (
                    <div ref={containerRef} className="h-64 w-full md:h-80 xl:h-[32rem]" />
                )}
            </div>

            <footer className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-400">
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-700/60 dark:bg-slate-800/40">
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        <span>导航模式</span>
                        <div className="inline-flex rounded-full border border-slate-200/70 bg-white/70 p-1 dark:border-slate-600 dark:bg-slate-800">
                            <button
                                type="button"
                                onClick={() => handleModeChange('walking')}
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${mode === 'walking' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-600 hover:text-emerald-500 dark:text-slate-300 dark:hover:text-emerald-200'}`}
                            >
                                步行
                            </button>
                            <button
                                type="button"
                                onClick={() => handleModeChange('driving')}
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${mode === 'driving' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-600 hover:text-emerald-500 dark:text-slate-300 dark:hover:text-emerald-200'}`}
                            >
                                驾车
                            </button>
                        </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">起点</span>
                            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2 dark:border-slate-600 dark:bg-slate-900/40">
                                <span className="text-xs text-slate-700 dark:text-slate-200">
                                    {selectedStart ? selectedStart.label : '未选择'}
                                </span>
                                {selectedStart && (
                                    <button
                                        type="button"
                                        onClick={() => handleSetStart(selectedStart.id)}
                                        className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-500"
                                    >
                                        清除
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">终点</span>
                            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2 dark:border-slate-600 dark:bg-slate-900/40">
                                <span className="text-xs text-slate-700 dark:text-slate-200">
                                    {selectedEnd ? selectedEnd.label : '未选择'}
                                </span>
                                {selectedEnd && (
                                    <button
                                        type="button"
                                        onClick={() => handleSetEnd(selectedEnd.id)}
                                        className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-500"
                                    >
                                        清除
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={handleGenerateRoute}
                            disabled={!canRequest || routeLoading}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {routeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RouteIcon className="h-3.5 w-3.5" aria-hidden />}
                            {routeLoading ? '规划导航中…' : '生成导航路线'}
                        </button>
                        {externalNavigationLink && routeResult && selectedStart && selectedEnd && (
                            <a
                                href={externalNavigationLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-400/70 px-3 py-1 text-[11px] font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-400/60 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                            >
                                <Navigation className="h-3 w-3" aria-hidden />
                                打开高德 App
                            </a>
                        )}
                        {!canRequest && (selectedStart || selectedEnd) && (
                            <span className="text-[11px] text-slate-400">请选择完整的起点与终点。</span>
                        )}
                    </div>

                    {routeError && (
                        <p className="mt-3 rounded-xl border border-rose-400/60 bg-rose-50/80 px-3 py-2 text-[11px] text-rose-600 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
                            {routeError}
                        </p>
                    )}

                    {routeResult && !routeError && (
                        <div className="mt-3 grid gap-2">
                            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-200">
                                {routeDistanceLabel && <span>全程 {routeDistanceLabel}</span>}
                                {routeDurationLabel && <span>预计耗时 {routeDurationLabel}</span>}
                            </div>
                            {routeResult.steps.slice(0, 6).map((step, index) => (
                                <div key={`step-${index}`} className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 text-[11px] dark:border-slate-600 dark:bg-slate-900/40">
                                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">
                                        {index + 1}
                                    </span>
                                    <div className="flex flex-col gap-1 text-slate-600 dark:text-slate-300">
                                        <span>{step.instruction || '直行'}</span>
                                        <span className="text-[10px] text-slate-400">
                                            {formatDistance(step.distance)} · {formatDuration(step.duration)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {routeResult.steps.length > 6 && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">路线较长，已仅展示前 6 步。</p>
                            )}
                        </div>
                    )}
                </div>

                {loading && <p>正在定位推荐地点…</p>}
                {error && <p className="text-rose-500 dark:text-rose-300">{error}</p>}
                {!loading && !error && points.length === 0 && <p>暂无可定位的地点，试着让 AI 给出更具体的景点或酒店名称。</p>}
                {groupedPoints.length > 0 && (
                    <div className="space-y-3">
                        {groupedPoints.map((group) => (
                            <section key={group.key} className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 dark:border-slate-700/60 dark:bg-slate-800/40">
                                <header className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                                    <span>{group.label}</span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{group.points.length} 个地点</span>
                                </header>
                                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                                    {group.points.map((point) => (
                                        <li key={point.id} className="rounded-xl border border-slate-200/70 bg-white/90 px-3 py-2 dark:border-slate-600 dark:bg-slate-900/40">
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{point.label}</p>
                                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                来源：{point.source}
                                            </p>
                                            {point.address && (
                                                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{point.address}</p>
                                            )}
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetStart(point.id)}
                                                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${startPointId === point.id ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:border-emerald-400/70 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-500 dark:border-slate-600 dark:text-slate-300 dark:hover:border-emerald-500/70 dark:hover:text-emerald-200'}`}
                                                >
                                                    设为起点
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetEnd(point.id)}
                                                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${endPointId === point.id ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:border-emerald-400/70 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-500 dark:border-slate-600 dark:text-slate-300 dark:hover:border-emerald-500/70 dark:hover:text-emerald-200'}`}
                                                >
                                                    设为终点
                                                </button>
                                                <a
                                                    href={`https://www.amap.com/search?keywords=${encodeURIComponent(point.label)}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-500"
                                                >
                                                    <Navigation className="h-3 w-3" aria-hidden />
                                                    查看
                                                </a>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}
            </footer>
        </section>
    );
}

function formatDistance(distance: number) {
    if (!Number.isFinite(distance) || distance <= 0) {
        return '0 米';
    }

    if (distance >= 1000) {
        const value = distance / 1000;
        const formatted = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
        return `${formatted} 公里`;
    }

    return `${Math.round(distance)} 米`;
}

function formatDuration(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return '约 0 分';
    }

    const minutes = Math.round(seconds / 60);
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remain = minutes % 60;
        if (remain > 0) {
            return `约 ${hours} 小时 ${remain} 分`;
        }
        return `约 ${hours} 小时`;
    }

    return `约 ${Math.max(minutes, 1)} 分`;
}
