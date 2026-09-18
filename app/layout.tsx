import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Travel Memory｜旅途手帳", description: "收藏世界足跡與旅行回憶，期待下一次出發。", icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" } };
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) { return <html lang="zh-Hant"><body>{children}</body></html>; }
