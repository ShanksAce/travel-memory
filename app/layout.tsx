import type { Metadata } from "next";
import "./globals.css";
import "./palette.css";
import { cookies } from "next/headers";
export const metadata: Metadata = { title: "行旅錄｜記所行，藏所感", description: "收藏世界足跡與旅行回憶，期待下一次出發。", icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" } };
export default async function RootLayout({ children }: {
    children: React.ReactNode;
}) { const store = await cookies(); const saved = store.get('travel_theme')?.value; const theme = ['journal','forest','ocean','night'].includes(saved || '') ? saved : 'journal'; const motion = store.get('travel_motion')?.value === 'reduce' ? 'reduce' : 'full'; return <html lang="zh-Hant" data-theme={theme} data-motion={motion}><body>{children}</body></html>; }
