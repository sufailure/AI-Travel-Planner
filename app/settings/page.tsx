import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageBackground } from '@/components/layout/page-background';
import { TopNavigation } from '@/components/layout/top-navigation';
import { ApiKeyManager } from '@/components/settings/api-key-manager';
import { createServerClient } from '@/lib/supabase/server';
import { ensureUserProfile } from '@/lib/supabase/queries';

export const metadata: Metadata = {
    title: '配置中心 | AI Travel Planner',
};

export default async function SettingsPage() {
    const supabase = createServerClient();
    if (!supabase) {
        redirect('/signin?redirect=/settings');
    }

    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
        redirect('/signin?redirect=/settings');
    }

    const profile = await ensureUserProfile(supabase, session.user);

    return (
        <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-16 text-slate-900 dark:text-slate-100 sm:px-10">
            <PageBackground />
            <TopNavigation displayName={profile?.display_name ?? '旅行者'} />

            <section className="relative mt-6 space-y-3">
                <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-100/80 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200">
                    Settings
                </p>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 sm:text-3xl">配置中心</h1>
                <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400 sm:text-base">
                    在此管理第三方 API Key。密钥将安全地保存在当前浏览器的 LocalStorage 中，不会上传到服务器；请确保不要将密钥粘贴到聊天记录或代码仓库。
                </p>
            </section>

            <ApiKeyManager />
        </main>
    );
}
