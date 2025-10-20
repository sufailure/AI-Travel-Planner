'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Plane } from 'lucide-react';
import { useCallback, useTransition } from 'react';
import { ThemeToggle } from '@/components/theme/theme-toggle';

type TopNavigationProps = {
    displayName?: string | null;
};

function cn(...classes: Array<string | null | undefined | false>) {
    return classes.filter(Boolean).join(' ');
}

const NAV_ITEMS = [
    { href: '/', label: '首页' },
    { href: '/planner', label: '智能规划' },
];

export function TopNavigation({ displayName }: TopNavigationProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleSignOut = useCallback(() => {
        startTransition(async () => {
            await fetch('/api/auth/signout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            router.push('/');
            router.refresh();
        });
    }, [router]);

    return (
        <nav className="relative z-20 flex items-center justify-between gap-6 rounded-3xl border border-slate-200/70 bg-white/80 px-5 py-3 shadow-md shadow-emerald-500/10 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-emerald-500/20">
            <div className="flex items-center gap-4">
                <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/90 text-white shadow-md">
                        <Plane className="h-4 w-4" aria-hidden />
                    </span>
                    AI Travel Planner
                </Link>
                <div className="hidden items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 sm:flex">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'inline-flex items-center rounded-full px-3 py-1.5 transition',
                                    isActive
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200'
                                        : 'hover:bg-slate-200/70 hover:text-emerald-600 dark:hover:bg-slate-800/60',
                                )}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
            <div className="flex items-center gap-3">
                {displayName && (
                    <span className="hidden text-sm font-medium text-slate-600 dark:text-slate-300 sm:inline-block">
                        {displayName}
                    </span>
                )}
                <ThemeToggle />
                <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300/60 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-emerald-400 hover:text-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700/70 dark:text-slate-200 dark:hover:border-emerald-400/70 dark:hover:text-emerald-200"
                >
                    <LogOut className="h-3.5 w-3.5" aria-hidden />
                    退出登录
                </button>
            </div>
        </nav>
    );
}
