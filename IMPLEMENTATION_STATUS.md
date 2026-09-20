# Travel Memory 實作狀態

最後依程式碼盤點日期：2026-09-20  
盤點基準：`feat/standalone-auth-deploy` 分支的實際程式碼、migration、CI 與部署設定。

## 目前狀態

Travel Memory 已從依賴 ChatGPT Sites 身分驗證的預覽網站，改造為可獨立部署的旅行手帳架構。旅行、足跡、日記、行程、準備清單與照片索引存於 Cloudflare D1，照片原始檔存於 R2。使用者改用 Travel Memory 自己的帳號與 Session，不再依賴 `oai-authenticated-user-*` headers。

目前改造位於 feature branch，需在 CI 全部通過後 merge 至 `main`。Cloudflare 正式部署仍需 repository owner 一次性設定 GitHub Actions Secrets；Secrets 不可提交至 Git。

## 技術棧

### Frontend
- React 19 + TypeScript。
- Vinext App Router / Vite。
- 主要介面：`app/travel-app.tsx`。
- 世界地圖：Leaflet / OpenStreetMap。
- 響應式 CSS，支援桌機與手機版面。

### Backend
- App Router Route Handlers，部署至 Cloudflare Workers。
- Zod 驗證輸入。
- Cloudflare D1 prepared statements。
- Cloudflare R2 儲存照片原始檔。

### Authentication
- `lib/auth.ts`：獨立帳號與 Session。
- 密碼：PBKDF2-SHA-256、每帳號獨立 salt、310,000 iterations。
- Session：32-byte random token；D1 僅保存 SHA-256 token hash。
- Cookie：HttpOnly、SameSite=Lax；HTTPS 使用 Secure。
- 登入失敗限制：15 分鐘視窗、5 次失敗後暫停；限制鍵使用 email + IP 的 SHA-256 hash。
- `lib/server.ts` 的 `identity()` 由 app session 取得使用者。
- 所有私人旅行資源仍以 Trip ownership 作為授權邊界。

## 資料表

既有：
- `trips`
- `places`
- `diaries`
- `itinerary`
- `tasks`
- `photos`

獨立登入新增：
- `users`
- `sessions`
- `auth_attempts`

Migration：
- `drizzle/0000_clean_thaddeus_ross.sql`
- `drizzle/0001_standalone_auth.sql`

## 已完成核心功能

- 建立、編輯、刪除旅行。
- 旅行狀態分類與倒數。
- 世界地圖足跡。
- 足跡 CRUD 與 ownership 驗證。
- 心情日記 CRUD。
- 每日行程與預算。
- 旅行準備清單與完成率。
- 照片多選上傳、讀取、下載、刪除。
- EXIF 日期與 GPS 解析。
- 離線鄰近城市分類與手動修正。
- 旅行／照片／日記搜尋。
- 旅行統計。
- JSON 文字紀錄匯出。
- Loading / Empty / Error / Confirmation 等基本 UX 狀態。

## 獨立網站改造已完成項目

- 移除應用程式對 ChatGPT Sites auth module 的依賴。
- 新增獨立註冊／登入畫面。
- 新增 `/api/auth/register`、`/api/auth/login`、`/api/auth/logout`。
- 保留舊 `/signin-with-chatgpt`、`/signout-with-chatgpt` URL 作為相容 redirect/logout route，避免既有 UI 連結立刻失效。
- 新增 D1 auth schema / migration。
- 移除 Vite 對 ChatGPT Sites hosting plugin 的依賴。
- 新增 `wrangler.jsonc`。
- 新增 GitHub Actions CI。
- 新增 GitHub Actions Cloudflare deployment workflow。
- 新增 `SECURITY.md` 與 `docs/DEPLOYMENT.md`。
- Integration / EXIF 測試流程已改用獨立測試帳號登入。

## CI / Testing

CI 設計會執行：
1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm test`
5. `npm run build`
6. `npm run db:local`
7. 啟動本機網站
8. `npm run test:integration`
9. `npm run test:exif`

本次 auth 改造曾在第一輪 CI 發現 Web Crypto `BufferSource` TypeScript 型別問題，已修正為明確的 `ArrayBuffer` PBKDF2 salt。最終狀態應以最新 GitHub Actions 結果為準；在 CI 尚未全部綠燈前不標示為正式完成。

## Deployment

目標流程：

```text
push / merge main
→ GitHub Actions
→ typecheck / tests / build
→ Wrangler deploy
→ Cloudflare Workers
→ D1 migrations
→ 固定 HTTPS workers.dev 網址
```

GitHub 需要一次性設定：
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

兩者只放 GitHub Actions Secrets，不放 repository。

## 舊 ChatGPT Sites 資料

新的獨立帳號 ID 與舊 ChatGPT Sites user ID 不同，因此舊站資料不會自動變成新帳號資料。

目前安全作法：
1. 舊站先匯出 JSON 文字紀錄。
2. 需要的照片另外下載原始檔。
3. 新站建立獨立帳號。
4. 之後再實作正式 Import / Migration 工具。

在 migration 工具完成前，不直接修改 production D1 的 `user_id` 做硬搬移。

## 尚未完成／技術債

- Forgot password / account recovery。
- Email verification。
- MFA / Passkey。
- 正式資料完整匯入／還原。
- 舊 ChatGPT Sites 帳號資料自動 migration。
- 全球 reverse geocoding。
- AI 圖像辨識／景點辨識／語意搜尋。
- 照片縮圖與大相簿分頁。
- 商用等級 WAF / rate limit / security audit。
- 壓力測試與完整 backup restore drill。

## 下一步

1. 讓 standalone branch CI 全部通過。
2. Merge 至 `main`。
3. 在 GitHub 設定 Cloudflare Secrets。
4. 執行第一次正式 deployment。
5. 驗證手機上的註冊、登入、旅行 CRUD、照片上傳與登出。
6. 記錄固定 HTTPS 網址。
7. 再評估舊資料匯入工具。
