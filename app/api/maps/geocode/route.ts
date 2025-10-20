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

    const destinationInput = typeof body.city === 'string' ? body.city.trim() : '';
    const destinationInfo = analyseDestination(destinationInput);

    const tasks = body.items
        .slice(0, 20)
        .filter((item) => typeof item?.query === 'string' && item.query.trim())
        .map(async (item) => {
            const query = item.query!.trim();
            const candidates = buildAddressCandidates(query, destinationInfo);

            for (const candidate of candidates) {
                const result = await geocodeAddress(apiKey, candidate, destinationInfo.cityQuery);
                if (result) {
                    return {
                        id: item.id ?? query,
                        query,
                        label: item.label ?? query,
                        source: item.source ?? '行程推荐',
                        name: result.formattedAddress ?? query,
                        address: result.formattedAddress ?? null,
                        location: {
                            lat: result.lat,
                            lng: result.lng,
                        },
                    };
                }
            }

            return null;
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

type GeocodeCandidate = {
    formattedAddress: string | null;
    lat: number;
    lng: number;
};

type DestinationInfo = {
    normalized: string;
    tokens: string[];
    countryHint: string | null;
    cityCandidate: string;
    cityQuery: string;
};

async function geocodeAddress(key: string, address: string, city: string): Promise<GeocodeCandidate | null> {
    try {
        const url = new URL(AMAP_ENDPOINT);
        url.searchParams.set('key', key);
        url.searchParams.set('address', address);
        url.searchParams.set('output', 'JSON');
        if (city) {
            url.searchParams.set('city', city);
        }

        const response = await fetch(url.toString());

        if (!response.ok) {
            return null;
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
            formattedAddress: first.formatted_address ?? null,
            lat,
            lng,
        };
    } catch (error) {
        return null;
    }
}

function analyseDestination(raw: string): DestinationInfo {
    const normalized = raw.replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim();
    const initialTokens = normalized
        ? normalized
            .split(/[\s,，、·/\\-]+/)
            .map((token) => token.trim())
            .filter(Boolean)
        : [];

    const tokenSet = new Set(initialTokens);
    let countryHint: string | null = null;

    const addTokens = (...values: string[]) => {
        values.forEach((value) => {
            if (value) {
                tokenSet.add(value);
            }
        });
    };

    const ensureCountry = (value: string) => {
        if (!countryHint) {
            countryHint = value;
        }
    };

    const lower = normalized.toLowerCase();

    if (normalized.includes('日本') || lower.includes('japan')) {
        ensureCountry('Japan');
        addTokens('日本', 'Japan');
    }

    if (normalized.includes('东京') || lower.includes('tokyo')) {
        ensureCountry('Japan');
        addTokens('东京', 'Tokyo');
    }

    if (normalized.includes('大阪') || lower.includes('osaka')) {
        ensureCountry('Japan');
        addTokens('大阪', 'Osaka');
    }

    if (normalized.includes('京都') || lower.includes('kyoto')) {
        ensureCountry('Japan');
        addTokens('京都', 'Kyoto');
    }

    if (normalized.includes('韩国') || lower.includes('korea')) {
        ensureCountry('South Korea');
        addTokens('韩国', 'South Korea');
    }

    if (normalized.includes('首尔') || lower.includes('seoul')) {
        ensureCountry('South Korea');
        addTokens('首尔', 'Seoul');
    }

    if (normalized.includes('美国') || lower.includes('united states') || lower.includes('usa')) {
        ensureCountry('United States');
        addTokens('美国', 'United States');
    }

    if (normalized.includes('英国') || lower.includes('united kingdom') || lower.includes('uk') || lower.includes('london')) {
        ensureCountry('United Kingdom');
        addTokens('英国', 'United Kingdom', 'London');
    }

    const chineseHints = deriveChineseLocationHints(normalized);
    if (chineseHints.tokens.length > 0) {
        addTokens(...chineseHints.tokens);
    }

    const hasChineseCharacters = /[\u4e00-\u9fff]/.test(normalized);
    if (hasChineseCharacters && !countryHint) {
        ensureCountry('China');
    }

    if (countryHint === 'China') {
        addTokens('中国', 'China');
    }

    const tokens = Array.from(tokenSet);

    let cityCandidate = tokens.find((token) => /[市区县镇乡道府]$/.test(token)) ?? '';

    if (!cityCandidate && chineseHints.cityCandidate) {
        cityCandidate = chineseHints.cityCandidate;
    }

    if (!cityCandidate) {
        const fallback = tokens.find((token) => /[\u4e00-\u9fff]{2,6}/.test(token));
        if (fallback) {
            cityCandidate = fallback;
        }
    }

    const cityQuery = cityCandidate || chineseHints.cityQuery || '';

    return {
        normalized,
        tokens,
        countryHint,
        cityCandidate,
        cityQuery,
    };
}

function buildAddressCandidates(query: string, info: DestinationInfo) {
    const base = query.replace(/\s+/g, ' ').trim();
    const variants = new Set<string>();

    if (base) {
        variants.add(base);
    }

    const joinedDestination = info.tokens.join(' ');

    if (base && joinedDestination) {
        variants.add(`${base} ${joinedDestination}`.trim());
    }

    if (base && info.cityQuery) {
        variants.add(`${base} ${info.cityQuery}`.trim());
    }

    for (const token of info.tokens) {
        variants.add(`${base} ${token}`.trim());
    }

    if (info.countryHint) {
        variants.add(`${base} ${info.countryHint}`.trim());
        if (joinedDestination) {
            variants.add(`${base} ${joinedDestination} ${info.countryHint}`.trim());
        }
    }

    return Array.from(variants)
        .map((variant) => variant.trim())
        .filter(Boolean)
        .slice(0, 6);
}

type ChineseLocationHints = {
    tokens: string[];
    cityCandidate?: string;
    cityQuery?: string;
};

function deriveChineseLocationHints(input: string): ChineseLocationHints {
    if (!/[\u4e00-\u9fff]/.test(input)) {
        return { tokens: [] };
    }

    const regions: Array<{
        keywords: string[];
        tokens: string[];
        cityDefault?: string;
    }> = [
            { keywords: ['北京市', '北京'], tokens: ['北京', '北京市'], cityDefault: '北京市' },
            { keywords: ['天津市', '天津'], tokens: ['天津', '天津市'], cityDefault: '天津市' },
            { keywords: ['上海市', '上海'], tokens: ['上海', '上海市'], cityDefault: '上海市' },
            { keywords: ['重庆市', '重庆'], tokens: ['重庆', '重庆市'], cityDefault: '重庆市' },
            { keywords: ['河北省', '河北'], tokens: ['河北', '河北省'] },
            { keywords: ['山西省', '山西'], tokens: ['山西', '山西省'] },
            { keywords: ['辽宁省', '辽宁'], tokens: ['辽宁', '辽宁省'] },
            { keywords: ['吉林省', '吉林'], tokens: ['吉林', '吉林省'] },
            { keywords: ['黑龙江省', '黑龙江'], tokens: ['黑龙江', '黑龙江省'] },
            { keywords: ['江苏省', '江苏'], tokens: ['江苏', '江苏省'] },
            { keywords: ['浙江省', '浙江'], tokens: ['浙江', '浙江省'] },
            { keywords: ['安徽省', '安徽'], tokens: ['安徽', '安徽省'] },
            { keywords: ['福建省', '福建'], tokens: ['福建', '福建省'] },
            { keywords: ['江西省', '江西'], tokens: ['江西', '江西省'] },
            { keywords: ['山东省', '山东'], tokens: ['山东', '山东省'] },
            { keywords: ['河南省', '河南'], tokens: ['河南', '河南省'] },
            { keywords: ['湖北省', '湖北'], tokens: ['湖北', '湖北省'] },
            { keywords: ['湖南省', '湖南'], tokens: ['湖南', '湖南省'] },
            { keywords: ['广东省', '广东'], tokens: ['广东', '广东省'] },
            { keywords: ['海南省', '海南'], tokens: ['海南', '海南省'] },
            { keywords: ['四川省', '四川'], tokens: ['四川', '四川省'] },
            { keywords: ['贵州省', '贵州'], tokens: ['贵州', '贵州省'] },
            { keywords: ['云南省', '云南'], tokens: ['云南', '云南省'] },
            { keywords: ['陕西省', '陕西'], tokens: ['陕西', '陕西省'] },
            { keywords: ['甘肃省', '甘肃'], tokens: ['甘肃', '甘肃省'] },
            { keywords: ['青海省', '青海'], tokens: ['青海', '青海省'] },
            { keywords: ['台湾省', '台湾'], tokens: ['台湾', '台湾省'] },
            { keywords: ['内蒙古自治区', '内蒙古'], tokens: ['内蒙古', '内蒙古自治区'] },
            { keywords: ['广西壮族自治区', '广西'], tokens: ['广西', '广西壮族自治区'] },
            { keywords: ['西藏自治区', '西藏'], tokens: ['西藏', '西藏自治区'] },
            { keywords: ['宁夏回族自治区', '宁夏'], tokens: ['宁夏', '宁夏回族自治区'] },
            { keywords: ['新疆维吾尔自治区', '新疆'], tokens: ['新疆', '新疆维吾尔自治区'] },
            { keywords: ['香港特别行政区', '香港'], tokens: ['香港', '香港特别行政区'], cityDefault: '香港特别行政区' },
            { keywords: ['澳门特别行政区', '澳门'], tokens: ['澳门', '澳门特别行政区'], cityDefault: '澳门特别行政区' },
        ];

    const normalizedInput = input.replace(/[|]/g, ' ').trim();
    const tokens = new Set<string>();
    let cityCandidate: string | undefined;
    let cityQuery: string | undefined;
    let matchedRegion: typeof regions[number] | null = null;

    for (const region of regions) {
        if (region.keywords.some((keyword) => normalizedInput.includes(keyword))) {
            matchedRegion = region;
            for (const token of region.tokens) {
                if (token) {
                    tokens.add(token);
                }
            }
            if (!cityCandidate && region.cityDefault) {
                cityCandidate = region.cityDefault;
                cityQuery = region.cityDefault;
            }
            break;
        }
    }

    let remainder = normalizedInput;

    if (matchedRegion) {
        for (const keyword of matchedRegion.keywords) {
            remainder = remainder.split(keyword).join(' ');
        }
    }

    remainder = remainder.replace(/(?:省|市|自治区|特别行政区|壮族|回族|维吾尔|藏族|苗族|蒙古族|彝族|土家族|傣族自治州)/g, ' ');

    const segments = remainder
        .split(/[\s,，、·/\\-]+/)
        .map((segment) => segment.replace(/[\d]{1,2}日|[\d]{1,2}晚|自由行|行程|旅游|套餐|线路|推荐/g, '').trim())
        .filter(Boolean);

    for (const segment of segments) {
        if (!/[\u4e00-\u9fff]/.test(segment)) {
            continue;
        }

        const match = segment.match(/([\u4e00-\u9fff]{2,5})(?:市|区|县|镇|乡|州|府)?/);
        if (!match) {
            continue;
        }

        const base = match[1];
        const decorated = match[0];

        tokens.add(base);
        if (decorated.endsWith('市') || decorated.endsWith('区') || decorated.endsWith('县')) {
            tokens.add(decorated);
        } else if (base.length <= 6) {
            tokens.add(`${base}市`);
        }

        if (!cityCandidate) {
            const candidateValue = decorated.endsWith('市') ? decorated : `${base}市`;
            cityCandidate = candidateValue;
            cityQuery = candidateValue;
        }
    }

    return {
        tokens: Array.from(tokens),
        cityCandidate,
        cityQuery,
    };
}
