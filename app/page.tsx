export default function HomePage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
            <div className="max-w-3xl text-center">
                <p className="text-sm uppercase tracking-[0.35em] text-slate-400">
                    AI Travel Planner
                </p>
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
                <button className="rounded-lg border border-slate-700 px-6 py-4 text-base font-medium text-slate-200 transition hover:border-slate-600 hover:text-white">
                    浏览示例行程 (敬请期待)
                </button>
            </div>
        </main>
    );
}
