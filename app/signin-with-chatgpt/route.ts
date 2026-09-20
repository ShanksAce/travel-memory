export function GET(request: Request) {
    const url = new URL(request.url);
    const returnTo = url.searchParams.get('return_to') || '/';
    const target = new URL('/signin', url.origin);
    target.searchParams.set('return_to', returnTo);
    return Response.redirect(target, 307);
}
