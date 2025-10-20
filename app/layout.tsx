import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'AI Travel Planner',
    description: 'Plan smart, travel smarter with AI-assisted itineraries.',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-CN" className={inter.className}>
            <body className="bg-slate-900 text-slate-100 antialiased">{children}</body>
        </html>
    );
}
