import { redirect } from "next/navigation";
import { getChatGPTUser, chatGPTSignInPath, standaloneAuthConfigured } from "../chatgpt-auth";

function safeReturnTo(value: string | undefined): string {
    return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function LoginPage({ searchParams }: {
    searchParams: Promise<{ return_to?: string; error?: string }>;
}) {
    const params = await searchParams;
    const returnTo = safeReturnTo(params.return_to);
    if (await getChatGPTUser())
        redirect(returnTo);
    if (!standaloneAuthConfigured())
        redirect(chatGPTSignInPath(returnTo));
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f7f4ee" }}>
        <section style={{ width: "min(420px, 100%)", background: "white", borderRadius: 24, padding: 32, boxShadow: "0 18px 60px rgba(42,37,31,.12)" }}>
            <p style={{ color: "#b25d3a", fontWeight: 700, letterSpacing: ".08em", margin: 0 }}>TRAVEL MEMORY</p>
            <h1 style={{ margin: "10px 0 8px", fontSize: 30 }}>登入我的旅途手帳</h1>
            <p style={{ color: "#6f675f", lineHeight: 1.7 }}>這是私人旅行空間，請輸入擁有者密碼。</p>
            {params.error ? <p role="alert" style={{ color: "#b42318", background: "#fff1f0", borderRadius: 12, padding: 12 }}>密碼不正確，請再試一次。</p> : null}
            <form action="/api/auth/login" method="post" style={{ display: "grid", gap: 14 }}>
                <input type="hidden" name="return_to" value={returnTo} />
                <label style={{ display: "grid", gap: 7, fontWeight: 700 }}>
                    擁有者密碼
                    <input name="password" type="password" required autoComplete="current-password" autoFocus style={{ font: "inherit", padding: "12px 14px", border: "1px solid #d8d1c8", borderRadius: 12 }} />
                </label>
                <button type="submit" style={{ font: "inherit", fontWeight: 800, color: "white", background: "#b25d3a", border: 0, borderRadius: 12, padding: "13px 16px", cursor: "pointer" }}>登入</button>
            </form>
        </section>
    </main>;
}
