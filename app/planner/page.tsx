import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Headphones, Map, Sparkles } from 'lucide-react';
import { BudgetTracker } from '@/components/planner/budget-tracker';
import { IntelligentPlanner } from '@/components/planner/intelligent-planner';
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

            <section className="grid gap-10 xl:grid-cols-[minmax(0,1.1fr),minmax(260px,320px)]">
                <IntelligentPlanner initialPreferences={initialPreferences} />
                <div className="flex flex-col gap-6">
                    <div className="rounded-3xl border border-slate-200/80 bg-white/85 p-6 text-sm text-slate-600 shadow-lg shadow-slate-200/30 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300">
                        <div className="flex items-start gap-3">
                            <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">
                                <Map className="h-4 w-4" aria-hidden />
                            </span>
                            <div className="flex flex-col gap-1">
                                <strong className="text-sm text-slate-900 dark:text-slate-100">最近的行程草稿</strong>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {latestItinerary
                                        ? formatItinerarySummary(latestItinerary.destination, latestItinerary.start_date, latestItinerary.end_date)
                                        : '暂无已保存的行程，生成完成后会出现在下方列表。'}
                                </p>
                            </div>
                        </div>
                        <div className="mt-5 rounded-2xl border border-slate-200/60 bg-slate-50/80 p-4 dark:border-slate-700/60 dark:bg-slate-800/40">
                            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                <Sparkles className="h-4 w-4" aria-hidden />
                                如何描述更精准？
                            </h2>
                            <ul className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                                <li>· 指定出发地与目的地，例如“上海到札幌”</li>
                                <li>· 给出人数、预算与偏好（亲子、美食、徒步等）</li>
                                <li>· 额外需求：是否需要签证提醒、无障碍、夜生活推荐</li>
                            </ul>
                        </div>
                        <Link
                            href="/"
                            className="mt-5 inline-flex items-center justify-center rounded-full border border-slate-300/70 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-emerald-400 hover:text-emerald-500 dark:border-slate-700/60 dark:text-slate-200 dark:hover:border-emerald-400/70 dark:hover:text-emerald-200"
                        >
                            返回首页查看概览
                        </Link>
                    </div>
                    <PreferencesPanel initialPreferences={initialPreferences} />
                    <BudgetTracker itineraryId={latestItinerary?.id ?? null} />
                </div>
            </section>

            <PlannerItineraryDrawer itineraries={itineraries} />
        </main>
    );
}

function formatItinerarySummary(destination?: string | null, start?: string | null, end?: string | null) {
    const place = destination?.trim() || '未命名目的地';
    const range = formatDateRange(start, end);
    return range ? `${place} · ${range}` : place;
}

function formatDateRange(start?: string | null, end?: string | null) {
    if (!start) {
        return '';
    }

    const startDate = parseDate(start);
    const endDate = end ? parseDate(end) : null;
    if (!startDate) {
        return '';
    }

    const formatter = new Intl.DateTimeFormat('zh-CN', {
        month: 'numeric',
        day: 'numeric',
    });

    const startLabel = formatter.format(startDate);
    const endLabel = endDate ? formatter.format(endDate) : '';
    return endLabel ? `${startLabel} - ${endLabel}` : `${startLabel} 出发`;
}

function parseDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
