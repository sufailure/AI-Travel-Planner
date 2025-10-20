import Link from 'next/link';
import { CalendarRange, MapPin, Plane, Users, Wallet2 } from 'lucide-react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { CreateItineraryForm } from '@/components/dashboard/create-itinerary-form';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

type Itinerary = Database['public']['Tables']['itineraries']['Row'];
type Profile = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'display_name'>;

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
});

export default async function HomePage() {
    const supabase = createServerClient();
    const session = supabase ? (await supabase.auth.getSession()).data.session : null;

    if (!session) {
        return <LandingSection />;
    }

    const profile = await ensureProfile(supabase, session.user);
    const itineraries = await fetchItineraries(supabase, session.user.id);

    return (
        <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 py-16 text-slate-900 dark:text-slate-100">
            <GradientBackground />
            <ThemeToggle className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6" />
            <header className="relative flex flex-col gap-4">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-100/80 px-4 py-1 text-xs font-semibold text-emerald-700 backdrop-blur dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                    <Plane className="h-4 w-4" aria-hidden />
                    欢迎回来，{profile?.display_name ?? '旅行者'}
                </div>
                <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50 sm:text-[2.6rem] sm:leading-[1.1]">
                    管理行程、预算与偏好，让 AI 帮你打造无缝旅程
                </h1>
                <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
                    查看即将出发的旅程，快速新建计划，并为后续的 AI 行程生成、语音助手与地图同步打好基础。
                </p>
            </header>

            <section className="relative grid gap-10 lg:grid-cols-[1.15fr,0.85fr]">
                <ItineraryList itineraries={itineraries} />
                <CreateItineraryForm />
            </section>
        </main>
    );
}

async function ensureProfile(
    supabase: SupabaseClient<Database> | null,
    user: User,
): Promise<Profile | null> {
    if (!supabase) {
        return null;
    }

    const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', user.id)
        .maybeSingle();

    if (existingProfile) {
        return existingProfile;
    }

    const defaultName =
        (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
        (typeof user.email === 'string' && user.email?.split('@')[0]) ||
        '旅行者';

    const { data: insertedProfile } = await supabase
        .from('profiles')
        .insert({
            id: user.id,
            display_name: defaultName,
        })
        .select('id, display_name')
        .single();

    return insertedProfile;
}

async function fetchItineraries(
    supabase: SupabaseClient<Database> | null,
    ownerId: string,
): Promise<Itinerary[]> {
    if (!supabase) {
        return [] as Itinerary[];
    }

    const { data } = await supabase
        .from('itineraries')
        .select('id, title, destination, start_date, end_date, travelers, budget, updated_at')
        .eq('owner_id', ownerId)
        .order('start_date', { ascending: true });

    return (data ?? []) as Itinerary[];
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

function ItineraryList({ itineraries }: { itineraries: Itinerary[] }) {
    if (!itineraries.length) {
        return (
            <div className="flex h-full flex-col justify-between gap-6 rounded-3xl border border-dashed border-emerald-500/30 bg-white/80 p-8 text-slate-600 shadow-sm backdrop-blur dark:border-emerald-500/40 dark:bg-slate-900/60 dark:text-slate-200">
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">暂无行程</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        使用右侧表单创建你的第一份旅行计划，AI 将根据你的偏好推荐交通、酒店与活动。
                    </p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-500">
                    创建设备同步、费用追踪与语音助手功能将在后续版本陆续开放，敬请期待。
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">我的行程</h2>
                <span className="rounded-full border border-emerald-400/40 bg-emerald-100/70 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                    共 {itineraries.length} 个计划
                </span>
            </div>
            <ul className="grid gap-4">
                {itineraries.map((itinerary) => (
                    <li
                        key={itinerary.id}
                        className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:border-emerald-300/60 hover:shadow-lg hover:shadow-emerald-200/20 dark:border-slate-800/80 dark:bg-gradient-to-br dark:from-slate-900/80 dark:via-slate-900/50 dark:to-slate-900/80 dark:hover:border-emerald-400/60 dark:hover:shadow-emerald-500/10"
                    >
                        <div className="pointer-events-none absolute -right-20 top-0 h-52 w-52 rounded-full bg-emerald-500/5 blur-3xl transition group-hover:bg-emerald-500/15 dark:bg-emerald-500/10 dark:group-hover:bg-emerald-500/20" />
                        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {itinerary.title || `${itinerary.destination} 行程`}
                                </h3>
                                <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                    <MapPin className="h-4 w-4 text-emerald-500 dark:text-emerald-300" aria-hidden />
                                    {itinerary.destination}
                                </p>
                            </div>
                            <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <CalendarRange className="h-4 w-4 text-emerald-500 dark:text-emerald-300" aria-hidden />
                                {formatDateRange(itinerary.start_date, itinerary.end_date)}
                                <span className="mx-2 h-4 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
                                <Users className="h-4 w-4 text-emerald-500 dark:text-emerald-300" aria-hidden />
                                {itinerary.travelers} 人
                            </p>
                        </div>
                        <div className="relative mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800/60">
                                最近更新：{formatDate(itinerary.updated_at)}
                            </span>
                            {typeof itinerary.budget === 'number' && (
                                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                                    <Wallet2 className="h-4 w-4 text-emerald-500 dark:text-emerald-200" aria-hidden />
                                    预算 ¥{itinerary.budget.toLocaleString('zh-CN')}
                                </span>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function GradientBackground() {
    return (
        <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-x-10 top-16 h-80 rounded-full bg-gradient-to-r from-emerald-300/30 via-cyan-300/25 to-purple-300/25 blur-[150px] dark:from-emerald-500/20 dark:via-cyan-500/20 dark:to-purple-500/20" />
            <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-emerald-300/25 blur-[120px] dark:bg-emerald-500/10" />
        </div>
    );
}

function formatDateRange(start: string | null, end: string | null) {
    if (!start || !end) {
        return '日期待定';
    }
    return `${formatDate(start)} - ${formatDate(end)}`;
}

function formatDate(value: string | null) {
    if (!value) {
        return '未知';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '未知';
    }
    return dateFormatter.format(date);
}
