import Link from 'next/link';

import Link from 'next/link';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { CreateItineraryForm } from '@/components/dashboard/create-itinerary-form';
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
        <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-14">
            <header className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Welcome back</p>
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">
                    {profile?.display_name ?? '旅行者'}的专属行程中心
                </h1>
                <p className="text-sm text-slate-400">
                    创建新行程、查看历史计划，稍后还能开启 AI 生成的预算与语音助手。
                </p>
            </header>

            <section className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
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
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
            <div className="max-w-3xl text-center">
                <p className="text-sm uppercase tracking-[0.35em] text-slate-400">AI Travel Planner</p>
                <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl">
                    让 AI 帮你规划下一次完美旅行
                </h1>
                <p className="mt-6 text-base leading-relaxed text-slate-300 sm:text-lg">
                    输入旅行目的地、天数、预算与偏好，马上生成包含交通、住宿、景点、餐饮与费用的智能行程。稍后我们会接入语音指令、地图导航与云端同步功能。
                </p>
            </div>
            <div className="flex flex-col items-stretch gap-4 sm:w-[480px]">
                <button className="rounded-lg bg-emerald-500 px-6 py-4 text-base font-medium text-slate-900 shadow transition hover:bg-emerald-400">
                    即将上线：开始规划
                </button>
                <Link
                    href="/signin"
                    className="rounded-lg border border-slate-700 px-6 py-4 text-center text-base font-medium text-slate-200 transition hover:border-slate-600 hover:text-white"
                >
                    登录以同步行程
                </Link>
            </div>
        </main>
    );
}

function ItineraryList({ itineraries }: { itineraries: Itinerary[] }) {
    if (!itineraries.length) {
        return (
            <div className="flex h-full flex-col justify-between gap-6 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6">
                <div>
                    <h2 className="text-lg font-semibold text-white">暂无行程</h2>
                    <p className="mt-2 text-sm text-slate-400">
                        使用右侧表单创建你的第一份旅行计划，AI 将在稍后帮助你完善行程细节与预算。
                    </p>
                </div>
                <p className="text-xs text-slate-500">
                    创建后可以在此查看所有行程，并将它们同步到地图和语音助手中。
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">我的行程</h2>
                <span className="text-xs text-slate-500">共 {itineraries.length} 个计划</span>
            </div>
            <ul className="flex flex-col gap-4">
                {itineraries.map((itinerary) => (
                    <li
                        key={itinerary.id}
                        className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-emerald-400/60"
                    >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-lg font-medium text-white">
                                    {itinerary.title || `${itinerary.destination} 行程`}
                                </h3>
                                <p className="text-sm text-slate-400">{itinerary.destination}</p>
                            </div>
                            <p className="text-sm text-slate-300">
                                {formatDateRange(itinerary.start_date, itinerary.end_date)} · {itinerary.travelers} 人
                            </p>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            <span>最近更新：{formatDate(itinerary.updated_at)}</span>
                            {typeof itinerary.budget === 'number' && (
                                <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300">
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
