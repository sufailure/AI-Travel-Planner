import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AMAP_ENDPOINT = 'https://restapi.amap.com/v3/geocode/geo';

export async function POST(request: NextRequest) {
    const apiKey = process.env.AMAP_REST_KEY ?? process.env.AMAP_WEB_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: '尚未配置高德地理编码密钥（AMAP_REST_KEY 或 AMAP_WEB_KEY）。' }, { status: 500 });
    }

    const body = (await request.json().catch(() => null)) as
        | {
            items?: Array<{ id?: string; query?: string; label?: string; source?: string }>;
            city?: string | null;
        }
        | null;

    if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json({ data: [] });
    }

    const city = typeof body.city === 'string' ? body.city.trim() : '';

    const tasks = body.items
        .slice(0, 20)
        .filter((item) => typeof item?.query === 'string' && item.query.trim())
        .map(async (item) => {
            const query = item.query!.trim();
            const url = new URL(AMAP_ENDPOINT);
            url.searchParams.set('key', apiKey);
            url.searchParams.set('address', query);
            if (city) {
                url.searchParams.set('city', city);
            }
            url.searchParams.set('output', 'JSON');

            const response = await fetch(url.toString());

            if (!response.ok) {
                throw new Error(`Geocode request failed: ${response.status}`);
            }

            const payload = (await response.json()) as {
                status?: string;
                info?: string;
                geocodes?: Array<{
                    formatted_address?: string;
                    location?: string;
                }>;
            };

            if (payload.status !== '1' || !payload.geocodes?.length) {
                return null;
            }

            const first = payload.geocodes[0];
            if (!first?.location) {
                return null;
            }

            const [lng, lat] = first.location.split(',').map((value) => Number(value));
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return null;
            }

            return {
                id: item.id ?? query,
                query,
                label: item.label ?? query,
                source: item.source ?? '行程推荐',
                name: first.formatted_address ?? query,
                address: first.formatted_address ?? null,
                location: {
                    lat,
                    lng,
                },
            };
        });

    try {
        const results = await Promise.all(tasks);
        const data = results.filter((item): item is NonNullable<typeof item> => Boolean(item));
        return NextResponse.json({ data });
    } catch (error) {
        const message = error instanceof Error ? error.message : '调用高德地理编码失败。';
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
