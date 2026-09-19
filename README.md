# Travel Memory｜旅途手帳
互動式旅遊規劃與足跡紀錄系統。資訊工程專題可展示版本，繁體中文介面。

## 已實作
- 私人登入與每個帳號的資料隔離。
- 建立、編輯、刪除旅行，依日期自動區分即將出發、旅行中、回憶收藏。
- 互動世界地圖、點選位置打卡、城市快速定位、足跡編輯。
- 原始照片上傳與下載；讀取 EXIF 拍攝日期／GPS、鄰近城市建議、日期／城市相簿、手動更正。
- 心情日記、每日行程、交通與住宿備忘、預估花費（新台幣）。
- 出發倒數、準備清單與完成率、旅行統計。
- 搜尋、文字紀錄 JSON 匯出、示範旅行。
- 桌機／手機版面，錯誤提示，表單日期及權限驗證。

## 本機開啟
需要 Node.js 22.13+（測試使用 Node.js 24）與 npm。首次安裝：
```powershell
npm ci
npm run build
npm run db:local
npm run dev -- --hostname 127.0.0.1
```
瀏覽器開啟終端顯示的網址，通常為 http://127.0.0.1:5173/ 。
按「登入我的手帳」，本機開發環境會使用測試帳號 Seedy；線上登入由 Sites 平台處理。

已在此電腦安裝套件並初始化本機資料庫。重新使用只需執行 npm run dev。也可執行專案根目錄的「啟動專題.ps1」。

如果 Windows 的 npm 捷徑報錯，可使用：
```powershell
node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run dev -- --hostname 127.0.0.1
```

## 資料儲存
本機 D1／R2 模擬資料在 .wrangler/state。正式網站使用 Sites 管理的 D1 資料庫與 R2 物件儲存。本機資料不會自動上傳到正式網站。不要刪除 .wrangler/state，除非確定要清空本機紀錄。

JSON 匯出包含文字與照片索引，不包含照片二進位檔。請另外下載原始照片；目前沒有 JSON 匯入／完整備份還原功能。

## 文件
- [更新紀錄](CHANGELOG.md)：每個正式版本的功能、修正與驗證結果。
- [專題報告](docs/專題報告.md)：動機、需求、架構、資料庫、演算法、測試、限制。
- [展示流程](docs/展示流程.md)：8 分鐘展示及簡報內容。
- [口試說明](docs/口試說明.md)：原理與常見問答。
- [測試紀錄](docs/test-results.json)：本次 23 項本機整合測試結果。
- [資料與授權](docs/資料與授權.md)。

## 測試
啟動本機網站後：
```powershell
npm run typecheck
npm test
npm run test:integration
npm run test:exif
```
整合測試會建立專用測試旅行並在結束時刪除，不會清除既有旅行。僅應對本機測試環境執行。

## 技術
React／TypeScript、Vinext App Router、Leaflet／OpenStreetMap、Cloudflare Workers／D1／R2、Drizzle migrations、Zod、exifr。

## 版本管理
目前正式版本為 `v0.1.0`。每次正式更新會保留原始碼版本、補寫 `CHANGELOG.md`、建立版本標籤並產生獨立 ZIP 備份；需要回復時可指定任一版本。程式版本與正式網站中的旅行資料分開保存，回復程式不會自動回復或刪除旅行紀錄與照片。

app/travel-app.tsx 是主要互動介面，app/world-map.tsx 是地圖；app/api 是後端；lib/model.ts 處理資料驗證及日期／統計；lib/cities.ts 是離線城市資料；db/schema.ts 定義關聯資料表。

## 已知界線
這是可運作的專題版本，並非完成商用驗證的服務。GPS 分類使用約 50 個城市的離線中心點，50 公里內才提供鄰近城市建議；不是全球地址反查，無法辨識照片裡的景點。不含 AI 圖像辨識。沒有 GPS 時不猜測位置。主畫面統計以手動打卡為準，上傳照片不會自動宣告曾經到訪某國家。

地圖底圖與東京示意照片需要網路。每次最多 20 張照片，每張 12 MB；HEIC 請先轉 JPEG。每趟最多 366 天。倒數使用台北日曆日期，照片 EXIF 無時區時保留相機記錄的日期。未完成使用者研究、壓力測試、付費服務評估、學校版型排版、指導老師驗收，請勿把這些當作已完成的研究成果。

