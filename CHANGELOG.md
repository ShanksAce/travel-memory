# 更新紀錄

本專案使用 `主版本.功能版本.修正版本` 編號：

- 主版本：大幅改版或資料結構不相容。
- 功能版本：加入新功能，既有功能仍可使用。
- 修正版本：修正錯誤、版面或文字。

## [Unreleased]

### 新增

- 新增 Travel Memory 獨立帳號註冊／登入，不再依賴 ChatGPT Sites authentication headers。
- 新增 D1 `users`、`sessions`、`auth_attempts` 資料表與 migration。
- 新增 PBKDF2-SHA-256 密碼雜湊、每帳號獨立 salt、HttpOnly Session Cookie 與登入失敗節流。
- 新增獨立登入／註冊手機版頁面。
- 新增 GitHub Actions CI，檢查 typecheck、lint、domain tests、build、D1/R2 integration 與 EXIF integration。
- 新增 GitHub Actions Cloudflare deployment workflow，預計由 `main` 自動部署 Workers、D1 與 R2。
- 新增 `SECURITY.md` 與 `docs/DEPLOYMENT.md`。

### 變更

- `lib/server.ts` 身分來源改為 Travel Memory 自己的 Session，既有 Trip ownership 驗證維持不變。
- Vite / Vinext 建置移除 ChatGPT Sites hosting plugin 依賴，改用獨立 Cloudflare Workers 設定。
- 新增 `wrangler.jsonc`，正式環境 binding 使用 `DB` 與 `BUCKET`。
- Integration 與 EXIF 測試改以獨立測試帳號登入。
- 舊 `/signin-with-chatgpt` 與 `/signout-with-chatgpt` URL 暫時保留相容 route，導向新的獨立登入／登出流程。
- Cloudflare deployment 改為先查找既有 D1 / R2 資源，再建立缺少的資源並綁定，重跑部署時不再重複建立同名 D1。

### 修正

- 首頁旅行統計數字不再補前導零；例如 0 顯示為 `0`，不再顯示為 `00`。
- 修正 Web Crypto PBKDF2 salt 的 TypeScript `BufferSource` 型別問題。
- 將 PBKDF2 迭代次數調整為 Cloudflare Workers Web Crypto 支援的 100,000 次。
- 第一個擁有者帳號建立後自動關閉註冊，避免公開網址被其他人建立帳號。
- 修正 Cloudflare 首次部署中途建立 D1 後，重新執行 workflow 會因同名資料庫已存在而失敗的問題。

### 文件

- 更新 `README.md`，說明獨立帳號、Cloudflare 部署、CI 與舊 ChatGPT Sites 資料的遷移限制。
- 更新 `IMPLEMENTATION_STATUS.md` 為獨立網站架構現況。

### 維護

- 補強 `.gitignore`，排除額外的私鑰、憑證、credentials、secrets、log 與 build cache 類型。
- Cloudflare API Token 與 Account ID 僅由 GitHub Actions Secrets 提供，不寫入 repository。

## [0.1.0] - 2026-09-20

### 新增

- 私人登入與不同帳號的資料隔離。
- 旅行建立、編輯、刪除與日期狀態分類。
- 世界地圖、地點打卡、城市快速定位與足跡編輯。
- 照片上傳、下載、EXIF 日期及 GPS 解析與手動更正。
- 心情日記、每日行程、交通住宿備忘與花費紀錄。
- 出發倒數、準備清單、完成率與旅行統計。
- 搜尋、JSON 文字資料匯出與示範旅行。

### 驗證

- 通過型別檢查、正式版建置、8 項領域測試、23 項 API 整合測試與 2 項 EXIF 測試。

### 已知限制

- JSON 匯出不包含照片原始檔，目前也沒有完整匯入還原功能。
- GPS 城市判斷使用離線城市中心點，並非全球地址反查。
