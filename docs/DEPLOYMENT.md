# Travel Memory 獨立部署

## 目標

Travel Memory 不再依賴 ChatGPT Sites，正式環境改為：

```text
GitHub main
→ GitHub Actions
→ Cloudflare Workers
→ D1（帳號與旅行資料）
→ R2（原始照片）
```

手機、平板與電腦都使用同一個固定 HTTPS 網址。

## 一次性設定

### 1. Cloudflare Account ID

登入 Cloudflare Dashboard，取得要部署到的 Account ID。

### 2. 建立 API Token

建立專門給 GitHub Actions 使用的 Cloudflare API Token。權限只開啟 Travel Memory deployment 所需的 Workers、D1、R2 存取，並限制到指定 account。

不要把 token 貼進：
- Git commit
- README
- `.env`
- issue / PR comment
- ChatGPT 對話

### 3. GitHub Repository Secrets

到 repository：

`Settings → Secrets and variables → Actions`

新增：
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

只需要設定一次。

## 自動部署

完成 Secrets 後，每次 merge / push 到 `main`：

1. 安裝 dependencies
2. TypeScript typecheck
3. Domain tests
4. Vinext production build
5. `wrangler deploy`
6. Cloudflare 自動 provision / reuse `DB` 與 `BUCKET`
7. 套用 `drizzle/` D1 migrations

Workflow：`.github/workflows/deploy.yml`

## Cloudflare bindings

`wrangler.jsonc`：

- `DB` → D1
- `BUCKET` → R2

程式端使用：

```ts
import { env } from 'cloudflare:workers';
```

正式資源 ID 不需要寫入程式碼。Wrangler 支援以 draft binding 自動 provision resource。

## Migration

本專案 migration 放在：

`drizzle/`

本機：

```bash
npm run db:local
```

正式環境：

```bash
npm run db:remote
```

Production workflow 會自動執行 remote migration。

## 第一次部署後

在 GitHub Actions 的 `Deploy to Cloudflare` log 中取得 Workers deployment URL，通常會是 Cloudflare 提供的 `workers.dev` HTTPS 網址。

把該網址：
- 加到手機書籤
- 作為測試／展示固定入口
- 記錄到 README（若要固定展示）

## 舊 ChatGPT Sites 資料

新的獨立帳號與舊 ChatGPT Sites 身份 ID 不相同，因此舊環境的私人資料不會自動對應到新帳號。

需要保留舊資料時：
1. 在舊網站匯出 JSON 文字紀錄。
2. 另外下載需要保留的照片原始檔。
3. 在新網站建立獨立帳號。
4. 後續再實作正式 import / migration 工具；在工具完成以前，不應直接修改 production D1 嘗試硬搬 user_id。

## 故障排除

### Workflow 顯示 deployment skipped

確認 GitHub Actions Secrets 已有：
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

### Worker 可以開但登入／資料 API 失敗

檢查 D1 migration 是否成功執行，以及 `DB` binding 是否存在。

### 照片上傳失敗

檢查 `BUCKET` R2 binding，以及 Cloudflare account 是否可使用 R2。

### 不要做

- 不要把 API Token commit 到 repository。
- 不要在未備份情況下 drop production table。
- 不要 force push 來處理 deployment 問題。
- 不要把 production D1 當本機測試 DB 使用。

## 帳號復原與 Google 登入

在 Cloudflare Worker 設定以下環境變數。正式站的 APP_ORIGIN 為 https://travel-memory.andy950721.workers.dev（不加結尾斜線）。

| 變數 | 用途 |
|---|---|
| APP_ORIGIN | 固定站點來源 |
| GOOGLE_CLIENT_ID | Google OAuth 網頁應用程式用戶端 ID |
| GOOGLE_CLIENT_SECRET | Google OAuth 用戶端密鑰，設為 Worker Secret |
| RESEND_API_KEY | Resend 寄信金鑰，設為 Worker Secret |
| RECOVERY_FROM_EMAIL | Resend 已驗證的寄件地址 |

Google OAuth 的授權重新導向 URI 為 APP_ORIGIN 加上 /api/auth/google/callback。本機測試使用忽略提交的 .dev.vars。資料庫尚未有擁有者時，可使用已驗證的 Gmail 直接註冊。已有擁有者時，首次使用相同 Gmail 登入會綁定 Google 身分。重設密碼連結 30 分鐘失效、限用一次。

新程式碼上線前須先套用 0005_account_backup_photo_location.sql。帳號復原、OAuth 與寄信設定仍須各做一次實際端到端驗證。
