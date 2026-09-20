# Travel Memory｜旅途手帳
互動式旅遊規劃與足跡紀錄系統。資訊工程專題可展示版本，繁體中文介面。

## 已實作
- 獨立帳號註冊／登入、HttpOnly Session Cookie、每個帳號的資料隔離。
- 建立、編輯、刪除旅行，依日期自動區分即將出發、旅行中、回憶收藏。
- 互動世界地圖、點選位置打卡、城市快速定位、足跡編輯。
- 原始照片上傳與下載；讀取 EXIF 拍攝日期／GPS、鄰近城市建議、日期／城市相簿、手動更正。
- 心情日記、每日行程、交通與住宿備忘、預估花費（新台幣）。
- 出發倒數、準備清單與完成率、旅行統計。
- 搜尋、文字紀錄 JSON 匯出、示範旅行。
- 桌機／手機版面，錯誤提示，表單日期及權限驗證。

## 本機開啟
需要 Node.js 22.13+（CI 使用 Node.js 24）與 npm。

首次安裝與建立本機資料庫：
```powershell
npm ci
npm run db:local
npm run dev -- --hostname 127.0.0.1
```

瀏覽器開啟終端顯示的網址，通常為 `http://127.0.0.1:5173/`。按「登入我的手帳」後可建立本機測試帳號；帳號與旅行資料都儲存在本機 D1 模擬環境。

正式建置：
```powershell
npm run typecheck
npm run build
```

如果 Windows 的 npm 捷徑報錯，可使用：
```powershell
node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run dev -- --hostname 127.0.0.1
```

## 資料儲存
- 本機 D1／R2 模擬資料：`.wrangler/state`
- 正式網站：Cloudflare D1／R2
- `.wrangler/state` 不提交 Git，也不會自動同步到正式網站。
- JSON 匯出包含文字與照片索引，不包含照片二進位檔；目前沒有完整匯入／備份還原功能。

從舊的 ChatGPT Sites 預覽環境切換到獨立網站時，舊環境帳號 ID 與新的獨立帳號不同，因此舊網站的私人資料不會自動併入新帳號。若有需要保留的舊資料，先使用既有匯出／下載功能備份。

## Cloudflare 自動部署
正式網站使用 Cloudflare Workers + D1 + R2。`main` branch 每次 push 都會啟動 `.github/workflows/deploy.yml`。

第一次啟用只需要在 GitHub repository 設定兩個 Secrets：
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Cloudflare API Token 請限制在實際部署所需的帳號與 Workers/D1/R2 權限，不要寫進程式碼、`.env` 或文件。

部署流程：
```text
push main
→ GitHub Actions 安裝套件
→ typecheck / domain tests / build
→ Wrangler 部署 Worker
→ 自動建立或沿用 D1 / R2 binding
→ 套用 D1 migrations
→ workers.dev 固定 HTTPS 網址更新
```

若 GitHub Secrets 尚未設定，部署 workflow 會安全略過 Cloudflare deployment，不會讓 secret 出現在 log。

## CI
Pull Request 與 `main` push 會執行：
```text
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run db:local
npm run test:integration
npm run test:exif
```

整合測試會使用專用測試帳號，建立測試旅行並在結束時刪除旅行資料。僅應對測試／本機環境執行。

## Authentication
獨立登入不再依賴 ChatGPT Sites header。

- 密碼：PBKDF2-SHA-256 + 每位使用者獨立 salt，不儲存明文密碼。
- Session：32-byte 隨機 token；資料庫只保存 token 的 SHA-256 hash。
- Cookie：HttpOnly、SameSite=Lax；HTTPS 正式環境加上 Secure。
- 登入防護：以電子郵件 + IP 的雜湊鍵做 15 分鐘失敗次數限制。
- API：每次以 session 解析使用者，再對 Trip 與相關資源做 ownership 驗證。

## 技術
React／TypeScript、Vinext App Router、Cloudflare Workers、D1、R2、Drizzle migrations、Leaflet／OpenStreetMap、Zod、exifr。

主要位置：
- `app/travel-app.tsx`：主要互動介面
- `app/world-map.tsx`：世界地圖
- `app/api`：後端 Route Handlers
- `lib/auth.ts`：獨立帳號、密碼、Session、登入節流
- `lib/server.ts`：API 共用的 DB、R2、身份與 ownership 檢查
- `db/schema.ts`：資料表定義
- `drizzle/`：D1 migrations
- `wrangler.jsonc`：Cloudflare bindings

## 文件
- [實作狀態](IMPLEMENTATION_STATUS.md)
- [更新紀錄](CHANGELOG.md)
- [專題報告](docs/專題報告.md)
- [展示流程](docs/展示流程.md)
- [口試說明](docs/口試說明.md)
- [測試紀錄](docs/test-results.json)
- [資料與授權](docs/資料與授權.md)

## 版本管理
目前正式版本為 `v0.1.0`。程式版本與正式網站中的旅行資料分開保存；回復程式版本不會自動回復或刪除 D1／R2 中的使用者資料。

## 已知界線
這是可運作的專題版本，並非完成商用驗證的服務。GPS 分類使用約 50 個城市的離線中心點，50 公里內才提供鄰近城市建議；不是全球地址反查，無法辨識照片裡的景點。不含 AI 圖像辨識。沒有 GPS 時不猜測位置。主畫面統計以手動打卡為準，上傳照片不會自動宣告曾經到訪某國家。

地圖底圖與東京示意照片需要網路。每次最多 20 張照片，每張 12 MB；HEIC 請先轉 JPEG。每趟最多 366 天。倒數使用台北日曆日期，照片 EXIF 無時區時保留相機記錄的日期。尚未完成正式商用等級的壓力測試、帳號救援／忘記密碼、電子郵件驗證與完整備份還原。
