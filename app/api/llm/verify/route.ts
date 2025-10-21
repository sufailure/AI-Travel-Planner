import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DASHSCOPE_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const DEFAULT_MODEL = process.env.LLM_MODEL_ID ?? 'qwen-plus';

export async function POST(request: NextRequest) {
    const payload = (await request.json().catch(() => null)) as { llmKey?: string; model?: string } | null;

    const apiKey = payload?.llmKey?.trim();
    if (!apiKey) {
        return NextResponse.json({ ok: false, error: '缺少 LLM API Key。' }, { status: 400 });
    }

    const model = payload?.model?.trim() || DEFAULT_MODEL;

    try {
        const response = await fetch(DASHSCOPE_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                input: {
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant.' },
                        { role: 'user', content: '请仅回复“OK”。' },
                    ],
                },
                parameters: {
                    result_format: 'message',
                    temperature: 0,
                    max_output_tokens: 4,
                },
            }),
            cache: 'no-store',
        });

        if (!response.ok) {
            const text = await response.text();
            return NextResponse.json(
                {
                    ok: false,
                    error: `验证失败：HTTP ${response.status}`,
                    detail: text.slice(0, 1200),
                },
                { status: response.status },
            );
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
