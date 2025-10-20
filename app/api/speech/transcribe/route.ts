import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import WebSocket from 'ws';

export const runtime = 'nodejs';

const HOST = 'iat-api.xfyun.cn';
const PATH = '/v2/iat';
const ENDPOINT = `wss://${HOST}${PATH}`;

type IatResponse = {
    code: number;
    message: string;
    data?: {
        status?: number;
        result?: {
            ws?: Array<{
                cw?: Array<{ w?: string }>;
            }>;
        };
    };
};

export async function POST(request: NextRequest) {
    const payload = (await request.json().catch(() => null)) as { audio?: string } | null;

    if (!payload?.audio) {
        return NextResponse.json({ error: '缺少音频数据。' }, { status: 400 });
    }

    const appId = process.env.XFYUN_APP_ID;
    const apiKey = process.env.XFYUN_API_KEY;
    const apiSecret = process.env.XFYUN_API_SECRET;
    const domain = process.env.XFYUN_DOMAIN ?? 'iat';

    if (!appId || !apiKey || !apiSecret) {
        return NextResponse.json({ error: '讯飞语音识别未配置，请检查环境变量。' }, { status: 500 });
    }

    try {
        const authUrl = buildAuthUrl({ apiKey, apiSecret });
        const transcription = await sendIatRequest(authUrl, {
            appId,
            audio: payload.audio,
            domain,
        });

        return NextResponse.json({ text: transcription });
    } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        return NextResponse.json({ error: `调用讯飞语音识别失败: ${message}` }, { status: 500 });
    }
}

function buildAuthUrl({ apiKey, apiSecret }: { apiKey: string; apiSecret: string }) {
    const date = new Date().toUTCString();
    const signatureOrigin = `host: ${HOST}\ndate: ${date}\nGET ${PATH} HTTP/1.1`;
    const signatureSha = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64');
    const authorization = Buffer.from(
        `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`,
    ).toString('base64');

    const url = new URL(ENDPOINT);
    url.searchParams.set('authorization', authorization);
    url.searchParams.set('date', date);
    url.searchParams.set('host', HOST);

    return url.toString();
}

type IatRequest = {
    appId: string;
    audio: string;
    domain: string;
};

async function sendIatRequest(url: string, { appId, audio, domain }: IatRequest) {
    return new Promise<string>((resolve, reject) => {
        const ws = new WebSocket(url);
        let finalText = '';

        ws.on('open', () => {
            const firstFrame = JSON.stringify({
                common: { app_id: appId },
                business: {
                    language: 'zh_cn',
                    domain,
                    accent: 'mandarin',
                    vad_eos: 5000,
                },
                data: {
                    status: 0,
                    format: 'audio/L16;rate=16000',
                    encoding: 'raw',
                    audio,
                },
            });

            ws.send(firstFrame);

            const lastFrame = JSON.stringify({
                data: {
                    status: 2,
                    format: 'audio/L16;rate=16000',
                    encoding: 'raw',
                    audio: '',
                },
            });

            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(lastFrame);
                }
            }, 50);
        });

        ws.on('message', (data) => {
            try {
                const payload = JSON.parse(data.toString()) as IatResponse;

                if (payload.code !== 0) {
                    reject(new Error(`${payload.code} ${payload.message}`));
                    ws.close();
                    return;
                }

                const words = payload.data?.result?.ws ?? [];
                for (const word of words) {
                    for (const item of word.cw ?? []) {
                        if (item.w) {
                            finalText += item.w;
                        }
                    }
                }

                if (payload.data?.status === 2) {
                    ws.close();
                    resolve(finalText.trim());
                }
            } catch (error) {
                reject(error instanceof Error ? error : new Error('讯飞返回解析失败'));
                ws.close();
            }
        });

        ws.on('error', (event) => {
            reject(new Error(`WebSocket 错误: ${event}`));
        });

        ws.on('close', (code) => {
            if (code !== 1000 && finalText === '') {
                reject(new Error(`WebSocket 已关闭: ${code}`));
            }
        });

        setTimeout(() => {
            if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
                ws.close();
                reject(new Error('讯飞语音识别超时'));
            }
        }, 20000);
    });
}
