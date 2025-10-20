'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import type { Database } from '@/lib/supabase/types';

export function SignInForm() {
    const router = useRouter();
    const supabase = useSupabaseClient<Database>();
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        setIsSubmitting(true);
        setMessage(null);

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${location.origin}/api/auth/callback`,
            },
        });

        if (error) {
            setMessage(error.message);
        } else {
            setMessage('登录魔法链接已经发送到你的邮箱，请在 5 分钟内完成验证。');
            setEmail('');
            router.refresh();
        }

        setIsSubmitting(false);
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6"
        >
            <div>
                <h2 className="text-xl font-semibold text-white">登录 / 注册</h2>
                <p className="mt-1 text-sm text-slate-400">使用邮箱获取一次性魔法链接，无需记住密码。</p>
            </div>

            <label className="flex flex-col gap-2 text-sm text-slate-300">
                邮箱地址
                <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none transition focus:border-emerald-400"
                    placeholder="you@example.com"
                />
            </label>

            <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {isSubmitting ? '发送中…' : '发送登录链接'}
            </button>

            {message && <p className="text-sm text-amber-300">{message}</p>}
        </form>
    );
}
