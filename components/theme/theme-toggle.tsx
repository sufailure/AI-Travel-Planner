'use client';

import { MoonStar, Sun } from 'lucide-react';
import { useTheme } from '@/components/providers/theme-provider';

type ThemeToggleProps = {
    className?: string;
};

function cn(...classes: Array<string | null | undefined | false>) {
    return classes.filter(Boolean).join(' ');
}

export function ThemeToggle({ className }: ThemeToggleProps) {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? '切换至浅色模式' : '切换至深色模式'}
            className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300/60 bg-white text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 dark:border-slate-700/70 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:border-emerald-400/70 dark:hover:text-emerald-300 dark:focus-visible:outline-emerald-300',
                className,
            )}
        >
            {theme === 'dark' ? <Sun className="h-5 w-5" aria-hidden /> : <MoonStar className="h-5 w-5" aria-hidden />}
        </button>
    );
}
