import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type DirectionMode = 'walking' | 'driving';

type DirectionRequestBody = {
    origin?: { lat?: number; lng?: number } | null;
    destination?: { lat?: number; lng?: number } | null;
    mode?: DirectionMode;
};

type DirectionStep = {
    instruction: string;
    distance: number;
    duration: number;
};

type DirectionResponse = {
    distance: number;
    duration: number;
    mode: DirectionMode;
    polyline: Array<{ lat: number; lng: number }>;
    steps: DirectionStep[];
};

const AMAP_DRIVING_ENDPOINT = 'https://restapi.amap.com/v5/direction/driving';
const AMAP_WALKING_ENDPOINT = 'https://restapi.amap.com/v5/direction/walking';

export async function POST(request: NextRequest) {
    const apiKey = process.env.AMAP_REST_KEY ?? process.env.AMAP_WEB_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: '尚未配置高德导航密钥（AMAP_REST_KEY 或 AMAP_WEB_KEY）。' },
            { status: 500 },
        );
    }

    const body = (await request.json().catch(() => null)) as DirectionRequestBody | null;
    const origin = body?.origin;
    const destination = body?.destination;
    const mode = body?.mode === 'driving' ? 'driving' : 'walking';

    if (!origin || !destination) {
        return NextResponse.json({ error: '缺少起点或终点信息。' }, { status: 400 });
    }

    if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
        return NextResponse.json({ error: '坐标格式无效。' }, { status: 400 });
    }

    const endpoint = mode === 'driving' ? AMAP_DRIVING_ENDPOINT : AMAP_WALKING_ENDPOINT;
    const url = new URL(endpoint);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('origin', `${origin.lng},${origin.lat}`);
    url.searchParams.set('destination', `${destination.lng},${destination.lat}`);
    url.searchParams.set('output', 'JSON');

    try {
        const response = await fetch(url.toString());

        if (!response.ok) {
            throw new Error(`导航请求失败：${response.status}`);
        }

        const payload = (await response.json()) as
            | {
                status?: string;
                info?: string;
                route?: {
                    paths?: Array<{
                        distance?: string;
                        duration?: string;
                        steps?: Array<{
                            instruction?: string;
                            distance?: string;
                            duration?: string;
                            polyline?: string;
                        }>;
                        polylines?: string[];
                    }>;
                };
            }
            | null;

        if (!payload || payload.status !== '1' || !payload.route?.paths?.length) {
            const mapped = mapAmapError(payload?.info, mode);
            return NextResponse.json({ error: mapped.message }, { status: mapped.status });
        }

        const primaryPath = payload.route.paths[0];
        const distance = Number(primaryPath?.distance ?? 0);
        const duration = Number(primaryPath?.duration ?? 0);
        const steps = (primaryPath?.steps ?? []).map((step) => ({
            instruction: step.instruction?.trim() || '直行',
            distance: Number(step.distance ?? 0),
            duration: Number(step.duration ?? 0),
        }));

        const polylinePoints = extractPolylinePoints(primaryPath);

        if (polylinePoints.length === 0) {
            return NextResponse.json(
                { error: '未能解析路线轨迹，请稍后重试。' },
                { status: 502 },
            );
        }

        const data: DirectionResponse = {
            distance: Number.isFinite(distance) ? distance : 0,
            duration: Number.isFinite(duration) ? duration : 0,
            polyline: polylinePoints,
            steps,
            mode,
        };

        return NextResponse.json({ data }, { status: 200 });
    } catch (error) {
        const fallback = error instanceof Error ? error.message : '调用高德导航接口失败。';
        if (fallback.includes('OVER_DIRECTION_RANGE')) {
            const mapped = mapAmapError('OVER_DIRECTION_RANGE', mode);
            return NextResponse.json({ error: mapped.message }, { status: mapped.status });
        }
        return NextResponse.json({ error: fallback }, { status: 502 });
    }
}

function isValidCoordinate(value: { lat?: number; lng?: number }): value is { lat: number; lng: number } {
    if (typeof value.lat !== 'number' || typeof value.lng !== 'number') {
        return false;
    }

    return Number.isFinite(value.lat) && Number.isFinite(value.lng);
}

function mapAmapError(info: string | undefined, mode: DirectionMode): { message: string; status: number } {
    const normalized = (info ?? '').toUpperCase();

    switch (normalized) {
        case 'OVER_DIRECTION_RANGE': {
            const hint =
                mode === 'walking'
                    ? '步行导航只支持较短距离，建议改用驾车模式或选择更近的地点。'
                    : '路线超出驾车导航范围，请尝试拆分行程或调整地点。';
            return {
                message: `路线超出导航支持范围。${hint}`,
                status: 400,
            };
        }
        case 'INVALID_USER_SCODE':
        case 'USER_SCODE_ERROR':
        case 'INVALID_USER_KEY':
        case 'INVALID_USER_IP':
        case 'INVALID_USER_DOMAIN':
            return {
                message: '高德密钥或安全校验未通过，请检查密钥、安全密钥与域名白名单配置。',
                status: 500,
            };
        case 'SERVICE_NOT_AVAILABLE':
        case 'INSUFFICIENT_PRIVILEGES':
            return {
                message: '当前账号未开通导航服务权限，请在高德开放平台检查应用权限配置。',
                status: 500,
            };
        default:
            return {
                message: info || '未能找到符合条件的路线，请调整地点或稍后再试。',
                status: 502,
            };
    }
}

function extractPolylinePoints(path: {
    steps?: Array<{ polyline?: string }>;
    polylines?: string[];
    polyline?: string;
}): Array<{ lat: number; lng: number }> {
    const points: Array<{ lat: number; lng: number }> = [];

    const collect = (polyline?: string) => {
        if (!polyline) {
            return;
        }
        const normalized = polyline.replace(/\|/g, ';');
        const couples = normalized.split(';');
        for (const couple of couples) {
            const [lng, lat] = couple.split(',').map((token) => Number(token));
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                points.push({ lat, lng });
            }
        }
    };

    if (typeof path.polyline === 'string' && path.polyline.trim()) {
        collect(path.polyline);
    }

    if (Array.isArray(path.polylines) && path.polylines.length > 0) {
        for (const segment of path.polylines) {
            collect(segment);
        }
    } else if (Array.isArray(path.steps)) {
        for (const step of path.steps) {
            collect(step.polyline);
        }
    }

    return points;
}
