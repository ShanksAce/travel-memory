import { db, bucket, identity, failure, ApiError } from '../../../../lib/server';
export async function GET(req: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) { try {
    const user = await identity();
    const { id } = await params;
    const photo = await db().prepare('SELECT p.* FROM photos p JOIN trips t ON p.trip_id=t.id WHERE p.id=? AND t.user_id=?').bind(id, user.userId).first<{
        object_key: string;
        content_type: string;
    }>();
    if (!photo)
        throw new ApiError(404, '找不到照片。');
    const file = await bucket().get(photo.object_key);
    if (!file)
        throw new ApiError(404, '照片檔案不存在。');
    return new Response(file.body, { headers: { 'Content-Type': photo.content_type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" } });
}
catch (e) {
    return failure(e);
} }
