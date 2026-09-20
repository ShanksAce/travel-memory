import { NextResponse } from "next/server";
import { chatGPTSignOutPath, SESSION_COOKIE, standaloneAuthConfigured } from "../chatgpt-auth";

function safeReturnTo(value: string | null): string {
    return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
    const returnTo = safeReturnTo(new URL(request.url).searchParams.get("return_to"));
    if (!standaloneAuthConfigured())
        return NextResponse.redirect(new URL(chatGPTSignOutPath(returnTo), request.url));
    const response = NextResponse.redirect(new URL(returnTo, request.url));
    response.cookies.set(SESSION_COOKIE, "", { expires: new Date(0), path: "/" });
    return response;
}
