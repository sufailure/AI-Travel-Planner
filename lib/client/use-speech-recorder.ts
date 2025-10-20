import { useCallback, useEffect, useRef, useState } from 'react';

export const SPEECH_FALLBACK_MESSAGE = '语音识别不可用，请改用文字输入。';

type RecorderController = {
    start: () => Promise<void>;
    stop: () => Promise<string | null>;
    dispose: () => void;
};

export type SpeechRecorderOptions = {
    onTranscript?: (text: string) => void;
};

export function useSpeechRecorder(options: SpeechRecorderOptions = {}) {
    const { onTranscript } = options;
    const recorderRef = useRef<RecorderController | null>(null);

    const [supportsSpeech, setSupportsSpeech] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastTranscript, setLastTranscript] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            setSupportsSpeech(false);
            return;
        }

        let stream: MediaStream | null = null;
        let audioContext: AudioContext | null = null;
        let processor: ScriptProcessorNode | null = null;
        let chunks: Float32Array[] = [];

        const cleanup = () => {
            processor?.disconnect();
            processor = null;
            if (audioContext) {
                audioContext.close().catch(() => undefined);
                audioContext = null;
            }
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
                stream = null;
            }
            chunks = [];
        };

        const startRecording = async () => {
            setError(null);

            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (err) {
                cleanup();
                throw new Error('获取麦克风权限失败，请检查系统设置。');
            }

            try {
                audioContext = new AudioContext();
            } catch (err) {
                cleanup();
                throw new Error('浏览器不支持录音播放环境，请更换浏览器重试。');
            }

            const source = audioContext.createMediaStreamSource(stream);
            const bufferSize = 4096;
            processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
            chunks = [];

            processor.onaudioprocess = (event) => {
                const data = event.inputBuffer.getChannelData(0);
                chunks.push(new Float32Array(data));
            };

            const silenceGain = audioContext.createGain();
            silenceGain.gain.value = 0;

            source.connect(processor);
            processor.connect(silenceGain);
            silenceGain.connect(audioContext.destination);
        };

        const stopRecording = async () => {
            if (!audioContext) {
                cleanup();
                return null;
            }

            const sampleRate = audioContext.sampleRate;
            const recordedChunks = chunks;
            cleanup();

            if (!recordedChunks.length) {
                return null;
            }

            const merged = mergeBuffers(recordedChunks);
            const resampled = resampleBuffer(merged, sampleRate, 16000);
            const pcm = floatTo16BitPCM(resampled);
            const base64 = arrayBufferToBase64(pcm.buffer);

            const response = await fetch('/api/speech/transcribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ audio: base64 }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                const errMsg = (data as { error?: string }).error ?? '语音识别失败，请稍后重试。';
                throw new Error(errMsg);
            }

            const data = (await response.json()) as { text?: string };
            return data.text?.trim() ? data.text.trim() : null;
        };

        recorderRef.current = {
            start: startRecording,
            stop: stopRecording,
            dispose: cleanup,
        };

        setSupportsSpeech(true);

        return () => {
            recorderRef.current?.dispose();
            recorderRef.current = null;
        };
    }, []);

    const toggleRecording = useCallback(async () => {
        if (!supportsSpeech || !recorderRef.current) {
            setError(SPEECH_FALLBACK_MESSAGE);
            return;
        }

        if (isListening) {
            setIsListening(false);
            setIsProcessing(true);
            try {
                const text = await recorderRef.current.stop();
                if (text) {
                    setLastTranscript(text);
                    onTranscript?.(text);
                }
            } catch (err) {
                console.error('Speech transcription failed', err);
                setError(err instanceof Error ? err.message : '语音识别失败，请稍后再试。');
            } finally {
                setIsProcessing(false);
            }
        } else {
            try {
                await recorderRef.current.start();
                setIsListening(true);
                setError(null);
            } catch (err) {
                console.error('Speech recorder start failed', err);
                setError(err instanceof Error ? err.message : '无法启动语音输入。');
                setIsListening(false);
            }
        }
    }, [supportsSpeech, isListening, onTranscript]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const resetTranscript = useCallback(() => {
        setLastTranscript(null);
    }, []);

    return {
        supportsSpeech,
        isListening,
        isProcessing,
        error,
        toggleRecording,
        clearError,
        lastTranscript,
        resetTranscript,
    };
}

function mergeBuffers(chunks: Float32Array[]) {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}

function resampleBuffer(buffer: Float32Array, originalRate: number, targetRate: number) {
    if (originalRate === targetRate) {
        return buffer;
    }

    const ratio = originalRate / targetRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i += 1) {
        const index = i * ratio;
        const leftIndex = Math.floor(index);
        const rightIndex = Math.min(Math.ceil(index), buffer.length - 1);
        const weight = index - leftIndex;
        const leftValue = buffer[leftIndex] ?? 0;
        const rightValue = buffer[rightIndex] ?? 0;
        result[i] = leftValue + (rightValue - leftValue) * weight;
    }

    return result;
}

function floatTo16BitPCM(buffer: Float32Array) {
    const output = new ArrayBuffer(buffer.length * 2);
    const view = new DataView(output);

    for (let i = 0; i < buffer.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, buffer[i] ?? 0));
        view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }

    return view;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}
