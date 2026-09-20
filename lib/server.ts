import { env } from 'cloudflare:workers';
import { getCurrentUser } from './auth';
export class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export function db() { if (!env.DB)
    throw new ApiError(503, '資料庫暫時無法使用，請稍後重試。'); return env.DB; }
export function bucket() { if (!env.BUCKET)
    throw new ApiError(503, '相片儲存空間暫時無法使用。'); return env.BUCKET; }
export async function identity() { const user = await getCurrentUser(); if (!user)
    throw new ApiError(401, '請先登入，再儲存旅行。'); return user; }
export function checkOrigin(req: Request) { const o = req.headers.get('origin'); if (o && o !== new URL(req.url).origin)
    throw new ApiError(403, '不允許跨網站操作。'); }
export async function ownTrip(id: string, userId: string) { const t = await db().prepare('SELECT * FROM trips WHERE id=? AND user_id=?').bind(id, userId).first(); if (!t)
    throw new ApiError(404, '找不到這趟旅行。'); return t; }
export function failure(e: unknown) { if (e instanceof ApiError)
    return Response.json({ error: e.message }, { status: e.status }); if (e && typeof e === 'object' && 'issues' in e)
    return Response.json({ error: '欄位格式不正確，請檢查日期、座標及必填內容。' }, { status: 400 }); console.error('Travel Memory API error', e); return Response.json({ error: '儲存失敗，資料仍保留在畫面中，請稍後再試。' }, { status: 500 }); }
