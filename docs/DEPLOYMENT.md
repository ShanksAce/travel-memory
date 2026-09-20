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
