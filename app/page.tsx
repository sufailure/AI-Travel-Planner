import Link from 'next/link';
import { CalendarCheck, Plane, Sparkles } from 'lucide-react';
import { PageBackground } from '@/components/layout/page-background';
import { TopNavigation } from '@/components/layout/top-navigation';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { createServerClient } from '@/lib/supabase/server';
import { ensureUserProfile, getUserItineraries } from '@/lib/supabase/queries';

export default async function HomePage() {
    const supabase = createServerClient();
    if (!supabase) {
        return <LandingSection />;
    }

    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
        return <LandingSection />;
    }

    const profile = await ensureUserProfile(supabase, session.user);
    const itineraries = await getUserItineraries(supabase, session.user.id);
    const nextTrip = itineraries[0] ?? null;

    return (
        <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 py-16 text-slate-900 dark:text-slate-100">
            <PageBackground />
            <TopNavigation displayName={profile?.display_name ?? '旅行者'} />

            <section className="relative mt-6 grid gap-6 rounded-3xl border border-slate-200/80 bg-white/85 px-8 py-10 shadow-lg shadow-emerald-500/10 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/70 lg:grid-cols-[1.4fr,0.6fr] lg:items-center">
                <div className="flex flex-col gap-4">
                    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-100/70 px-4 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                        <Plane className="h-4 w-4" aria-hidden />
                        欢迎回来，{profile?.display_name ?? '旅行者'}
                    </span>
                    <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50 sm:text-[2.6rem] sm:leading-[1.1]">
                        你的旅行控制台：随时掌握计划，探索新的行程灵感
                    </h1>
                    <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
                        在这里管理即将出发的旅程、添加备选路线，并跳转到智能规划页，通过语音或文字一键生成专属行程方案。
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/planner"
                            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-md shadow-emerald-500/20 transition hover:from-emerald-400 hover:via-emerald-300 hover:to-cyan-300"
                        >
                            <Sparkles className="h-4 w-4" aria-hidden />
                            前往智能规划
                        </Link>
                    </div>
                </div>
                <aside className="hidden rounded-3xl border border-emerald-400/40 bg-emerald-100/60 p-6 text-sm text-emerald-700 shadow-inner dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 lg:flex lg:flex-col lg:gap-3">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-100">
                            <CalendarCheck className="h-5 w-5" aria-hidden />
                        </span>
                        <div className="flex flex-col">
                            <span className="text-xs uppercase tracking-wide text-emerald-500/80">下一个行程</span>
                            <strong className="text-sm text-emerald-700 dark:text-emerald-100">
                                {nextTrip ? formatTripSummary(nextTrip.destination, nextTrip.start_date, nextTrip.end_date) : '暂无行程，开始制定吧！'}
                            </strong>
                        </div>
                    </div>
                    <ul className="space-y-2 text-xs leading-relaxed">
                        <li>· 语音描述会自动提取目的地、日期与预算</li>
                        <li>· 支持多轮生成，保留原始模型回复便于校对</li>
                        <li>· 规划完成后可在此页保存并继续管理</li>
                    </ul>
                </aside>
            </section>

            <section className="rounded-3xl border border-slate-200/80 bg-white/85 px-8 py-10 text-sm text-slate-600 shadow-lg shadow-emerald-500/10 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-200">
                <div className="flex flex-col gap-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">继续探索</h2>
                    <p>
                        使用智能规划页面即可语音或文字生成行程，并在同一处管理「我的行程」。下一个旅程：
                        <span className="ml-1 font-medium text-emerald-600 dark:text-emerald-300">
                            {nextTrip ? formatTripSummary(nextTrip.destination, nextTrip.start_date, nextTrip.end_date) : '暂无，快去规划吧！'}
                        </span>
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/planner"
                            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/70 px-5 py-2 text-xs font-semibold text-emerald-600 transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-500/50 dark:text-emerald-200 dark:hover:border-emerald-400/70 dark:hover:bg-emerald-500/10"
                        >
                            立即打开智能规划
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    );
}

function formatTripSummary(destination?: string | null, start?: string | null, end?: string | null) {
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

function LandingSection() {
    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 overflow-hidden px-6 py-20 text-slate-900 dark:text-slate-100">
            <ThemeToggle className="absolute right-6 top-6 z-20" />
            <div className="absolute inset-0 -z-10 bg-slate-100 dark:bg-slate-950">
                <div className="absolute -top-56 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-400/30 blur-[140px] dark:bg-emerald-500/30" />
                <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-cyan-400/25 blur-[120px] dark:bg-cyan-500/20" />
                <div className="absolute -bottom-40 right-1/4 h-72 w-72 rounded-full bg-purple-400/25 blur-[120px] dark:bg-purple-500/20" />
            </div>

            <div className="max-w-3xl text-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-100/80 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-100">
                    <Plane className="h-4 w-4" aria-hidden />
                    AI TRAVEL PLANNER
                </span>
                <h1 className="mt-6 text-4xl font-semibold leading-tight text-slate-900 dark:text-slate-50 sm:text-[3.2rem] sm:leading-[1.1]">
                    让 AI 与语音助手成为你的私人旅行策划师
                </h1>
                <p className="mt-6 text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
                    告诉我们目的地、预算与偏好，即刻生成涵盖交通、住宿、景点与餐饮的全方位行程。后续还会提供费用跟踪、地图导航与多设备同步。
                </p>
            </div>

            <div className="flex flex-col items-stretch gap-4 sm:w-[420px]">
                <Link
                    href="/signin"
                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 px-6 py-4 text-base font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:from-emerald-400 hover:via-emerald-300 hover:to-cyan-300"
                >
                    立即体验智能行程
                </Link>
                <button className="rounded-2xl border border-slate-300/80 bg-white/80 px-6 py-4 text-base font-medium text-slate-700 backdrop-blur transition hover:border-slate-300 hover:bg-white dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-slate-500/80 dark:hover:bg-slate-900">
                    了解功能与路线模板（敬请期待）
                </button>
            </div>
        </main>
    );
}

