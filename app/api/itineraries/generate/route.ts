import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { PlannerResult } from '@/lib/types/planner';

const DASHSCOPE_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const DEFAULT_MODEL = process.env.LLM_MODEL_ID ?? 'qwen-plus';

const SYSTEM_PROMPT = `You are an expert travel planner. Given trip details, return a JSON object that outlines a family-friendly travel itinerary. Always reply in Chinese.

Return JSON with the following structure:
{
  "overview": string,
  "dailyPlan": [
    {
      "title": string,
      "summary": string,
      "activities": [string],
      "meals": [string]
    }
  ],
  "transportation": [string],
  "accommodations": [string],
  "restaurants": [string],
  "estimatedBudget": [
    {
      "category": string,
      "amount": number,
      "currency": string,
      "notes": string
    }
  ],
  "tips": [string]
}
`;

type GenerateRequestPayload = {
    destination?: string;
    startDate?: string | null;
    endDate?: string | null;
    travelers?: number | null;
    budget?: number | null;
    preferences?: string;
    llmKey?: string;
    llmKeyId?: string | null;
};

type ChatCompletionResponse = {
    output?: {
        text?: string;
        choices?: Array<{
            message?: {
                role?: string;
                content?: string;
            };
        }>;
    };
    code?: number;
    message?: string;
};

export async function POST(request: NextRequest) {
    const payload = (await request.json().catch(() => null)) as GenerateRequestPayload | null;

    if (!payload) {
        return NextResponse.json({ error: '请求体格式错误。' }, { status: 400 });
    }

    const { destination, startDate, endDate, travelers, budget, preferences, llmKey } = payload;

    const apiKey = llmKey?.trim();

    if (!apiKey) {
        return NextResponse.json({ error: '未检测到可用的 LLM API Key，请先在设置页面填写并验证。' }, { status: 400 });
    }

    const trimmedDestination = destination?.trim() ?? '';
    const trimmedPreferences = preferences?.trim() ?? '';
    const inferredDestination = trimmedDestination || inferDestination(trimmedPreferences) || '';

    if (!inferredDestination && !trimmedPreferences) {
        return NextResponse.json({ error: '请提供旅行目的地或偏好描述。' }, { status: 400 });
    }

    const planPrompt = buildUserPrompt({
        destination: inferredDestination || '未指定目的地',
        startDate,
        endDate,
        travelers,
        budget,
        preferences: inferredDestination && !trimmedDestination
            ? `${trimmedPreferences}
（系统推测目的地：${inferredDestination}）`
            : trimmedPreferences,
    });

    try {
        const response = await fetch(DASHSCOPE_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                input: {
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: planPrompt },
                    ],
                },
                parameters: {
                    result_format: 'message',
                    temperature: 0.8,
                },
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            return NextResponse.json({ error: `LLM 请求失败: ${response.status} ${errorBody}` }, { status: 502 });
        }

        const completion = (await response.json()) as ChatCompletionResponse;

        if (completion.code && completion.code !== 200) {
            return NextResponse.json(
                { error: `LLM 请求失败: ${completion.code} ${completion.message ?? ''}` },
                { status: 502 },
            );
        }
        const content =
            completion.output?.text ??
            completion.output?.choices?.[0]?.message?.content ??
            '';
        const parsed = extractItinerary(content);

        if (!parsed) {
            return NextResponse.json({ error: '未能解析 AI 返回的行程，请稍后重试。', raw: content }, { status: 502 });
        }

        return NextResponse.json({ plan: parsed, raw: content });
    } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        return NextResponse.json({ error: `调用行程规划服务失败: ${message}` }, { status: 500 });
    }
}

type PromptInput = Required<Pick<GenerateRequestPayload, 'destination'>> & Omit<GenerateRequestPayload, 'destination'>;

function buildUserPrompt({ destination, startDate, endDate, travelers, budget, preferences }: PromptInput) {
    const payload = {
        destination,
        startDate: startDate ?? null,
        endDate: endDate ?? null,
        travelers: travelers ?? null,
        budget: budget ?? null,
        preferences: preferences ?? '',
    };

    return `根据以下 JSON 输入设计旅行行程，包含交通、住宿、景点、餐厅与注意事项：\n${JSON.stringify(payload, null, 2)}\n请严格按照约定结构返回 JSON。`;
}

function inferDestination(text: string) {
    if (!text) {
        return '';
    }

    const patterns = [
        /(?:想去|准备去|计划去|要去|去|到)([^0-9，。,！？!?]{2,20})/i,
        /目的地(?:是|为)?([^\s，。,！？!?]{2,20})/i,
    ];

    for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match?.[1]) {
            const segment = match[1].split(/[，,。；;！!？?、]/)[0] ?? '';
            const cleaned = segment
                .replace(/(旅行|旅游|玩|看看|一下|附近|那边|这里|那里|城市|地方)$/u, '')
                .trim();
            if (cleaned) {
                return cleaned;
            }
        }
    }

    return '';
}

function extractItinerary(content: string): PlannerResult | null {
    if (!content) {
        return null;
    }

    const jsonSegment = findJsonSegment(content);
    if (!jsonSegment) {
        return null;
    }

    try {
        const parsed = JSON.parse(jsonSegment);
        return normalisePlan(parsed);
    } catch (error) {
        console.error('Failed to parse AI itinerary JSON:', error, jsonSegment);
        return null;
    }
}

function findJsonSegment(text: string) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        return null;
    }
    return text.slice(start, end + 1);
}

function normalisePlan(candidate: unknown): PlannerResult | null {
    if (!candidate || typeof candidate !== 'object') {
        return null;
    }

    const parsed = candidate as Partial<PlannerResult>;

    return {
        overview: typeof parsed.overview === 'string' ? parsed.overview : '行程概览未知。',
        dailyPlan: Array.isArray(parsed.dailyPlan)
            ? parsed.dailyPlan.map((item) => ({
                title: typeof item?.title === 'string' ? item.title : '行程日程',
                summary: typeof item?.summary === 'string' ? item.summary : '',
                activities: Array.isArray(item?.activities)
                    ? item.activities.filter((activity): activity is string => typeof activity === 'string')
                    : [],
                meals: Array.isArray(item?.meals)
                    ? item.meals.filter((meal): meal is string => typeof meal === 'string')
                    : [],
            }))
            : [],
        transportation: Array.isArray(parsed.transportation)
            ? parsed.transportation.filter((item): item is string => typeof item === 'string')
            : [],
        accommodations: Array.isArray(parsed.accommodations)
            ? parsed.accommodations.filter((item): item is string => typeof item === 'string')
            : [],
        restaurants: Array.isArray(parsed.restaurants)
            ? parsed.restaurants.filter((item): item is string => typeof item === 'string')
            : [],
        estimatedBudget: Array.isArray(parsed.estimatedBudget)
            ? parsed.estimatedBudget
                .map((entry) => ({
                    category: typeof entry?.category === 'string' ? entry.category : '其他',
                    amount: typeof entry?.amount === 'number' && Number.isFinite(entry.amount) ? entry.amount : 0,
                    currency: typeof entry?.currency === 'string' ? entry.currency : 'CNY',
                    notes: typeof entry?.notes === 'string' ? entry.notes : '',
                }))
                .filter((entry) => entry.category)
            : [],
        tips: Array.isArray(parsed.tips)
            ? parsed.tips.filter((tip): tip is string => typeof tip === 'string')
            : [],
    };
}
