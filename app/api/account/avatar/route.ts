import { identity, checkOrigin, bucket, failure, ApiError } from '../../../../lib/server';
export async function GET() {
    try {
        const user = await identity();
        const object = await bucket().get('avatars/' + user.userId);
        if (!object) return new Response(null, { status: 404 });
        return new Response(object.body, { headers: { 'Content-Type': object.httpMetadata?.contentType || 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    } catch (error) { return failure(error); }
}
export async function POST(req: Request) {
    try {
        checkOrigin(req);
        const user = await identity();
        if (Number(req.headers.get('content-length')) > 3 * 1024 * 1024) throw new ApiError(413, '頭貼上限 2 MB。');
        const file = (await req.formData()).get('file');
        if (!(file instanceof File) || !file.size || file.size > 2 * 1024 * 1024) throw new ApiError(400, '請選擇 2 MB 以內的照片。');
        const bytes = new Uint8Array(await file.arrayBuffer());
        const type = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
            : bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10' ? 'image/png'
            : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' ? 'image/webp' : '';
        if (!type) throw new ApiError(400, '只支援 JPEG、PNG、WebP 圖片。');
        await bucket().put('avatars/' + user.userId, bytes, { httpMetadata: { contentType: type } });
        return Response.json({ ok: true });
    } catch (error) { return failure(error); }
}
export async function DELETE(req: Request) {
    try { checkOrigin(req); const user = await identity(); await bucket().delete('avatars/' + user.userId); return Response.json({ ok: true }); }
    catch (error) { return failure(error); }
}
