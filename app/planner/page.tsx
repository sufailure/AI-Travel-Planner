import { redirect } from 'next/navigation';
import { Headphones, Sparkles } from 'lucide-react';
import { BudgetTracker } from '@/components/planner/budget-tracker';
import { IntelligentPlanner } from '@/components/planner/intelligent-planner';
import { PlannerAIOverview } from '@/components/planner/ai-overview';
import { PreferencesPanel } from '@/components/planner/preferences-panel';
import { PlannerItineraryDrawer } from '@/components/planner/itinerary-drawer';
import { PageBackground } from '@/components/layout/page-background';
import { TopNavigation } from '@/components/layout/top-navigation';
import { createServerClient } from '@/lib/supabase/server';
import { ensureUserProfile, getUserItineraries } from '@/lib/supabase/queries';
import { normalizeUserPreferences, sanitizeUserPreferences } from '@/lib/types/preferences';

export default async function PlannerPage() {
    const supabase = createServerClient();
    if (!supabase) {
        redirect('/signin?redirect=/planner');
    }

    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
        redirect('/signin?redirect=/planner');
    }

    const profile = await ensureUserProfile(supabase, session.user);
    const itineraries = await getUserItineraries(supabase, session.user.id);
    const latestItinerary = itineraries[0] ?? null;
    const initialPreferences = sanitizeUserPreferences(
        normalizeUserPreferences(profile?.preferences ?? null),
    );

    return (
        <main className="relative mx-auto flex min-h-screen w-full max-w-[1400px] flex-col gap-12 px-6 py-16 text-slate-900 dark:text-slate-100 lg:px-10">
            <PageBackground />
            <TopNavigation displayName={profile?.display_name ?? '旅行者'} />

            <header className="relative mt-6 overflow-hidden rounded-3xl border border-emerald-500/30 bg-white/85 px-8 py-10 shadow-lg shadow-emerald-500/20 backdrop-blur dark:border-emerald-500/40 dark:bg-slate-900/70">
                <div className="absolute -top-20 right-10 h-32 w-32 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-500/20" />
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex max-w-2xl flex-col gap-3">
                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-100/80 px-4 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                            <Sparkles className="h-4 w-4" aria-hidden />
                            智能行程规划台
                        </span>
                        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50 sm:text-[2.4rem] sm:leading-[1.1]">
                            语音与 AI 联动，几分钟生成完整旅行安排
                        </h1>
                        <p className="text-sm text-slate-600 dark:text-slate-300 sm:text-base">
                            通过语音或文字描述你的目的地、日期与偏好，系统会自动解析关键信息并调用模型生成交通、住宿、餐饮与每日行程建议。
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 rounded-2xl border border-emerald-400/40 bg-white/90 px-5 py-4 text-sm text-emerald-700 shadow-inner dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                        <span className="flex items-center gap-2 font-semibold">
                            <Headphones className="h-4 w-4" aria-hidden />
                            小提示
                        </span>
                        <ul className="space-y-2 text-xs leading-relaxed">
                            <li>· 语音结束后会自动转写并补全目的地、预算等字段</li>
                            <li>· 可以继续补充偏好内容，模型会记住最新上下文</li>
                            <li>· 生成结果会同步至下方「我的行程」，方便保存与调整</li>
                        </ul>
                    </div>
                </div>
            </header>

            <section className="grid gap-8 xl:grid-cols-[minmax(240px,2fr)_minmax(0,4fr)_minmax(240px,2fr)]">
                <div className="xl:sticky xl:top-28 xl:h-fit xl:max-w-[320px]">
                    <IntelligentPlanner initialPreferences={initialPreferences} />
                </div>
                <PlannerAIOverview />
                <div className="flex flex-col gap-6 xl:sticky xl:top-28 xl:h-fit xl:max-w-[320px]">
                    <PreferencesPanel initialPreferences={initialPreferences} />
                    <BudgetTracker itineraryId={latestItinerary?.id ?? null} />
                </div>
            </section>

            <PlannerItineraryDrawer itineraries={itineraries} />
        </main>
    );
}
