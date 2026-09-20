import { env } from "cloudflare:workers";
import { db, failure, ApiError } from "../../../../lib/server";

function authorized(request: Request): boolean {
    const value = request.headers.get("authorization");
    return Boolean(env.MIGRATION_TOKEN && value === `Bearer ${env.MIGRATION_TOKEN}`);
}

export async function GET(request: Request) {
    try {
        if (!authorized(request))
            throw new ApiError(404, "Not found");
        const tables = ["trips", "places", "diaries", "itinerary", "tasks", "photos"] as const;
        const results = await db().batch(tables.map(table => db().prepare(`SELECT * FROM ${table}`)));
        return Response.json(Object.fromEntries(tables.map((table, index) => [table, results[index].results])), {
            headers: { "Cache-Control": "no-store" },
        });
    }
    catch (error) {
        return failure(error);
    }
}
