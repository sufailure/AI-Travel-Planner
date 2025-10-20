'use client';

import {
    createContext,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'ai-travel-theme';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function getPreferredTheme(): Theme {
    if (typeof window === 'undefined') {
        return 'dark';
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
        return stored;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({
    children,
    defaultTheme = 'dark',
}: {
    children: ReactNode;
    defaultTheme?: Theme;
}) {
    const [theme, setTheme] = useState<Theme>(defaultTheme);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        setTheme(getPreferredTheme());
    }, [defaultTheme]);

    useIsomorphicLayoutEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const root = document.documentElement;
        const nextTheme = theme ?? defaultTheme;

        root.classList.remove('light', 'dark');
        root.classList.add(nextTheme);
        root.style.colorScheme = nextTheme;

        window.localStorage.setItem(STORAGE_KEY, nextTheme);
    }, [theme, defaultTheme]);

    const value = useMemo<ThemeContextValue>(() => {
        const updateTheme = (next: Theme) => setTheme(next);
        const toggleTheme = () => setTheme((previous) => (previous === 'dark' ? 'light' : 'dark'));

        return {
            theme,
            setTheme: updateTheme,
            toggleTheme,
        };
    }, [theme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }

    return context;
}
