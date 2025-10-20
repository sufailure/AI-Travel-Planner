import Link from 'next/link';
import { SignInForm } from '@/components/auth/sign-in-form';

export default function SignInPage() {
    return (
        <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-10 px-4 py-16">
            <div className="text-center">
                <p className="text-sm uppercase tracking-[0.35em] text-slate-400">AI Travel Planner</p>
                <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">登录以同步你的行程</h1>
                <p className="mt-2 text-sm text-slate-400">
                    尚未拥有账号？首次登录时会自动为你创建。
                </p>
            </div>
            <SignInForm />
            <Link href="/" className="text-sm text-emerald-300 transition hover:text-emerald-200">
                返回首页
            </Link>
        </main>
    );
}
