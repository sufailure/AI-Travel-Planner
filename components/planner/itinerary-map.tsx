'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { useItineraryMapPoints } from '@/lib/client/use-itinerary-map-points';
import type { PlannerResult } from '@/lib/types/planner';

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
    }
}

let amapLoader: Promise<AMapNamespace> | null = null;

function loadAmapJs(key: string) {
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

    useEffect(() => {
        if (!jsKey) {
            setMapError('尚未配置 NEXT_PUBLIC_AMAP_JS_KEY，无法加载地图。');
            return;
        }

        let destroyed = false;

        const initialize = async () => {
            try {
                const AMap = await loadAmapJs(jsKey);
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
    }, [jsKey]);

    useEffect(() => {
        if (!isMapReady || !amapRef.current || !mapRef.current) {
            return;
        }

        const AMap = amapRef.current;
        const map = mapRef.current;

        map.clearMap();

        if (!points.length) {
            return;
        }

        const markers = points.map((point) => {
            return new AMap.Marker({
                position: [point.lng, point.lat],
                title: point.label,
            });
        });

        map.add(markers);
        map.setFitView(markers, true, [60, 60, 60, 60]);

        return () => {
            markers.forEach((marker: any) => marker.setMap(null));
        };
    }, [isMapReady, points]);

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
                    <div ref={containerRef} className="h-72 w-full" />
                )}
            </div>

            <footer className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                {loading && <p>正在定位推荐地点…</p>}
                {error && <p className="text-rose-500 dark:text-rose-300">{error}</p>}
                {!loading && !error && points.length === 0 && <p>暂无可定位的地点，试着让 AI 给出更具体的景点或酒店名称。</p>}
                {points.length > 0 && (
                    <ul className="grid gap-2 sm:grid-cols-2">
                        {points.map((point) => (
                            <li key={point.id} className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 dark:border-slate-700/60 dark:bg-slate-800/40">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{point.label}</p>
                                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                    来源：{point.source}
                                </p>
                                {point.address && (
                                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{point.address}</p>
                                )}
                                <a
                                    href={`https://www.amap.com/search?keywords=${encodeURIComponent(point.label)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-500"
                                >
                                    <Navigation className="h-3 w-3" aria-hidden />
                                    在高德地图查看
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </footer>
        </section>
    );
}
