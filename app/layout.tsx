import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SupabaseProvider } from '@/components/providers/supabase-provider';
import { createServerClient } from '@/lib/supabase/server';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'AI Travel Planner',
    description: 'Plan smart, travel smarter with AI-assisted itineraries.',
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    let session = null;

    try {
        const supabase = createServerClient();
        if (supabase) {
            const {
                data: { session: currentSession },
            } = await supabase.auth.getSession();
            session = currentSession ?? null;
        }
    } catch (error) {
        console.warn('Supabase session fetch skipped:', error);
    }

    return (
        <html lang="zh-CN" className={inter.className}>
            <body className="bg-slate-900 text-slate-100 antialiased">
                <SupabaseProvider initialSession={session}>{children}</SupabaseProvider>
            </body>
        </html>
    );
}
