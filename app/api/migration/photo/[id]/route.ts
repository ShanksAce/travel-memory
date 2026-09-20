import { env } from "cloudflare:workers";
import { bucket, db, failure, ApiError } from "../../../../../lib/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (!env.MIGRATION_TOKEN || request.headers.get("authorization") !== `Bearer ${env.MIGRATION_TOKEN}`)
            throw new ApiError(404, "Not found");
        const { id } = await params;
        const photo = await db().prepare("SELECT object_key, content_type FROM photos WHERE id=?").bind(id).first<{
            object_key: string;
            content_type: string;
        }>();
        if (!photo)
            throw new ApiError(404, "Not found");
        const file = await bucket().get(photo.object_key);
        if (!file)
            throw new ApiError(404, "Not found");
        return new Response(file.body, { headers: { "Content-Type": photo.content_type, "Cache-Control": "no-store" } });
    }
    catch (error) {
        return failure(error);
    }
}
