import Link from 'next/link';
import { SignInForm } from '@/components/auth/sign-in-form';
import { ThemeToggle } from '@/components/theme/theme-toggle';

export default function SignInPage() {
    return (
        <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-10 px-4 py-16 text-slate-900 dark:text-slate-100">
            <ThemeToggle className="absolute right-6 top-6" />
            <div className="text-center">
                <p className="text-sm uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">AI Travel Planner</p>
                <h1 className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">
                    登录以同步你的行程
                </h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    尚未拥有账号？首次登录时会自动为你创建。
                </p>
            </div>
            <SignInForm />
            <Link
                href="/"
                className="text-sm font-medium text-emerald-600 transition hover:text-emerald-500 dark:text-emerald-300 dark:hover:text-emerald-200"
            >
                返回首页
            </Link>
        </main>
    );
}
