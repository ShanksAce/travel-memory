import { NextResponse } from "next/server";
import { createOwnerSession, ownerPasswordMatches, SESSION_COOKIE, standaloneAuthConfigured } from "../../../chatgpt-auth";

function safeReturnTo(value: FormDataEntryValue | null): string {
    const path = typeof value === "string" ? value : "/";
    return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

export async function POST(request: Request) {
    if (!standaloneAuthConfigured())
        return NextResponse.redirect(new URL("/login", request.url), 303);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
        return new NextResponse("Forbidden", { status: 403 });
    const form = await request.formData();
    const returnTo = safeReturnTo(form.get("return_to"));
    const password = String(form.get("password") || "");
    if (!(await ownerPasswordMatches(password))) {
        const destination = new URL("/login", request.url);
        destination.searchParams.set("return_to", returnTo);
        destination.searchParams.set("error", "1");
        return NextResponse.redirect(destination, 303);
    }
    const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
    response.cookies.set(SESSION_COOKIE, await createOwnerSession(), {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
    });
    return response;
}
