# Travel Memory 實作狀態

最後依程式碼盤點日期：2026-09-20  
盤點基準：目前 `main` 分支的原始碼、`package.json`、`.openai/hosting.json`、D1 migration、API route、測試與專案文件。本文不把先前對話或介面文案當作完成證據；無法由儲存庫確認的事項會標示為「未確認」。

## 0. 接手摘要

Travel Memory 是一個以單一首頁承載多個工作區的私人旅行手帳。核心資料不是瀏覽器假資料：旅行、足跡、日記、行程、待辦和照片索引會寫入 Cloudflare D1，照片原始 bytes 會寫入 Cloudflare R2。正式環境的身分由 Sites／ChatGPT 登入層提供，API 會以平台 user ID 篩選旅行所有權。

目前是可展示、可實際儲存資料的專題版本，但還不是完整商用品質。最明顯的缺口是完整備份還原、照片縮圖與分頁、跨 D1/R2 的故障補償、多帳號正式環境端到端測試，以及手機長表單對話框的可用性。

主要入口：

- UI：`app/page.tsx` → `app/travel-app.tsx`
- 地圖：`app/world-map.tsx`
- API：`app/api/data/route.ts`、`app/api/actions/route.ts`、`app/api/photos/route.ts`、`app/api/photos/[id]/route.ts`
- 驗證與權限：`app/chatgpt-auth.ts`、`lib/server.ts`
- 資料驗證與計算：`lib/model.ts`、`lib/cities.ts`
- Schema／migration：`db/schema.ts`、`drizzle/0000_clean_thaddeus_ross.sql`

## 1. 目前使用的技術棧

### Frontend

- React `19.2.6`、TypeScript `5.9.3`。
- Vinext `1.0.0-beta.5`，以 Next App Router 相容目錄組織頁面和 Route Handlers；建置器為 Vite `8.0.13`。
- 主要產品介面是 `app/travel-app.tsx` 的 client component，使用 React state、effect 和原生 `<dialog>`。
- 樣式集中在 `app/globals.css`，以自訂 CSS 與 media query 實作；圖示使用 Lucide React。
- 儲存庫含一整套 `components/ui` 元件和多個 UI 依賴，但目前核心 Travel Memory 頁面沒有匯入這些元件。`react-hook-form`、Recharts、Embla、Sonner、Vaul、date-fns 等也沒有出現在核心功能程式碼中。
- 沒有 Redux、Zustand 或其他全域狀態庫；每次 mutation 後重新呼叫 `/api/data` 取得完整資料集。

### Backend

- App Router Route Handlers，建置後執行於 Cloudflare Worker 相容環境。
- API 以 Web `Request`／`Response`、Cloudflare `env` binding、D1 prepared statement 與 R2 API 實作。
- 輸入驗證使用 Zod `3.25.76`。
- `db/index.ts` 有 Drizzle runtime helper，但目前 API 實際 CRUD 使用原生 D1 SQL；此 helper 在目前程式碼沒有被呼叫。

### Database

- Cloudflare D1（SQLite）。正式 binding 名稱為 `DB`。
- Drizzle ORM／Drizzle Kit 用於 schema 宣告與 migration 產生；目前 runtime 查詢主要是手寫 prepared SQL。
- 本機透過 Wrangler／Miniflare 模擬 D1，狀態放在被 Git 忽略的 `.wrangler/state`。

### Authentication

- 正式環境使用 Sites 提供的 Sign in with ChatGPT 流程。
- 應用從 `oai-authenticated-user-id`、`oai-authenticated-user-email` 和名稱相關 request headers 讀取身分，不保存密碼。
- UI 使用 `/signin-with-chatgpt`、`/signout-with-chatgpt`；API 每次呼叫 `identity()` 再驗證所有權。
- 本機 portable preview 透過 Sites Vite plugin 的 mock auth 模式測試。
- 平台 session 的保存時間、撤銷策略、MFA 與底層 OAuth 設定：**未確認**，不在此儲存庫內。

### Storage

- Cloudflare R2，正式 binding 名稱為 `BUCKET`。
- R2 保存原始 JPEG／PNG／WebP bytes；D1 的 `photos.object_key` 保存物件位置和照片 metadata。
- 不含縮圖服務、影像轉檔、CDN URL 或 R2 lifecycle 設定。

### Map service

- Leaflet `1.9.4`。
- 底圖直接請求 `https://tile.openstreetmap.org/{z}/{x}/{y}.png`，保留 OpenStreetMap attribution。
- 地圖標記來自資料庫中的 `places`；點地圖可取得座標並開啟新增足跡表單。
- 沒有 geocoding／reverse geocoding API；城市建議使用 `lib/cities.ts` 的離線座標表。

### Hosting / Deployment

- `.openai/hosting.json` 指定 Sites project、D1 `DB` 與 R2 `BUCKET`。
- 建置結果為 Cloudflare Worker 相容輸出；本機使用 Wrangler／Miniflare。
- 原始碼已具備 Sites 部署設定。由程式碼無法確認目前線上實際部署的是哪一個 commit、資料庫 migration 是否已在每個環境套用、服務區域與備援策略，因此這些項目標記為 **未確認**。

### AI / Image recognition service

- **沒有 AI 圖像辨識服務，也沒有 OpenAI API 呼叫。**
- 照片分類只讀取 EXIF 拍攝日期與 GPS，再以 Haversine 距離和約 50 筆離線城市中心點比對；不分析影像內容，也不辨識景點或人物。
- 頁面可選擇性註冊兩個 `document.modelContext` browser tools：讀取目前已載入的旅行摘要，以及打開新增旅行表單。第二個工具不會自動儲存。這不是圖片辨識，也不是伺服器端 AI 功能；宿主不支援時會安靜略過。

## 2. 已完成的頁面／畫面

實際只有一個產品 route：`/`。它在同一個 client workspace 內切換以下畫面，沒有獨立 URL route：

1. **我的世界**：統計、世界地圖、下一趟旅行倒數、近期旅行卡片。
2. **我的旅行**：全部旅行列表、狀態篩選、關鍵字搜尋、新增旅行。
3. **旅行相簿**：全部或指定旅行、依日期／城市分組、搜尋、上傳、照片 lightbox。
4. **心情日記**：跨旅行日記列表、全文關鍵字搜尋、新增／編輯／刪除。
5. **旅行詳情**：旅行資訊與四個頁籤：行程規劃、旅行足跡、旅行相簿、心情日記。
6. **表單對話框**：旅行、足跡、日記、行程、準備項目、照片資訊的新增／編輯。
7. **刪除確認對話框**與**照片檢視對話框**。
8. **登入／登出**：由平台路徑 `/signin-with-chatgpt`、`/signout-with-chatgpt` 處理，不是本專案自行實作的帳密頁。

API routes 不是使用者頁面：`GET /api/data`、`POST /api/actions`、`POST /api/photos`、`GET /api/photos/:id`。

## 3. 已完成的功能

- 建立、編輯、刪除旅行；旅行日期反轉、無效日期與超過 366 天會被拒絕。
- 依台北日曆日期把旅行分類為「即將出發／旅行中／回憶收藏」。
- 旅行名稱、國家和城市搜尋，以及狀態篩選。
- 下一趟旅行倒數。
- 世界地圖顯示已到訪足跡；地圖點選、城市中心快速選擇、座標手動修改。
- 新增、編輯、刪除足跡，並限制日期在旅行範圍內。
- 每日行程：日期、時間、分類、標題、備忘、預估花費；依日期與時間呈現。
- 預估花費加總，目前固定以新台幣記錄。
- 準備清單：新增、切換完成狀態、刪除、完成百分比。
- 心情日記：日期、五種心情、標題、內文；支援新增、編輯、刪除、搜尋。
- 單次最多選擇 20 張照片，逐張上傳；單檔上限 12 MB。
- 以檔案 signature 驗證 JPEG、PNG、WebP，不只相信瀏覽器提供的 MIME type。
- 讀取 EXIF `DateTimeOriginal`／`CreateDate` 與 GPS。
- GPS 有效時使用離線城市表尋找 50 公里內最近城市；無匹配時保留 GPS 並標示「待確認地點」。
- 照片 metadata 手動修正：日期、城市／分類、說明；不修改原始照片 bytes。
- 照片依日期或城市分組、搜尋、檢視、下載原始檔、刪除。
- 統計已到訪國家／地區、城市、已走過旅行天數及照片數；未來足跡不列入已到訪統計，重疊旅行天數去重。
- JSON 文字資料匯出。
- 載入可重複執行的示範旅行資料；同一使用者不會重複加入同一組 demo ID。
- 刪除旅行時透過 SQLite foreign key cascade 移除關聯資料，並先刪除已知 R2 照片物件。
- 登入檢查、旅行所有權檢查、同源寫入檢查、Zod 欄位驗證與 prepared SQL。
- 照片讀取端點有 `private, no-store`、`nosniff` 與限制內容執行的 CSP header。
- loading、empty state、成功訊息、表單錯誤、刪除確認與地圖底圖失敗提示。

## 4. 部分完成的功能

1. **資料匯出／備份**：可匯出 D1 已載入的文字紀錄與照片索引，但不含 R2 照片 bytes，沒有匯入與還原。
2. **照片自動分類**：EXIF 解析與離線鄰近城市可用，但城市表只有約 50 筆，沒有全球地址反查、行政區判斷或景點辨識。
3. **多張照片上傳**：UI 可一次選取最多 20 張，但實際是逐張 request；部分成功、部分失敗時不會整批 rollback。
4. **響應式介面**：有 1200／950／800／520 px media queries；一般卡片和導覽會重排，但長表單 dialog 缺少可靠的內部捲動區，在部分手機 viewport 可能看不到底部操作按鈕。
5. **搜尋**：旅行、照片和日記有 client-side 搜尋；資料仍全量下載，沒有 server-side 搜尋、排序或分頁。
6. **地圖定位**：能點選座標與使用離線城市中心點，但沒有使用者目前位置、地址搜尋、路線規劃或離線地圖。
7. **WebMCP／宿主工具**：只註冊讀取摘要與開啟新增旅行表單兩項；依賴宿主的非標準 `document.modelContext`，不可用時不影響一般網頁。
8. **測試**：有 domain、D1/R2 本機整合及 EXIF 測試；正式雲端多帳號、手機瀏覽器矩陣、負載、滲透與可用性測試未完成。

## 5. 尚未完成的功能

- 完整備份、匯入與還原（包含 R2 原始照片）。
- 縮圖、responsive image、背景轉檔、相簿分頁與大量照片效能處理。
- HEIC／HEIF 直接上傳。
- 全球 reverse geocoding、地址／景點搜尋、國家與城市標準化。
- AI 圖像標籤、物件／景點／人物辨識。
- 由照片位置經使用者確認後自動建立地圖足跡。
- 社群分享、公開旅行頁、共同編輯、留言或按讚。
- owner／editor／viewer 等應用層角色；目前只有資料擁有者模型。
- 旅行資料匯入、行事曆同步、訂房／機票 API、通知提醒。
- 離線模式、PWA、背景同步。
- 應用層 rate limit、使用量配額、審計紀錄、管理後台。
- 正式監控、告警、錯誤追蹤與 D1/R2 定期一致性修復工作。
- 自動化 CI workflow：儲存庫目前沒有 `.github/workflows`。

## 6. Mock Data／假資料

### 產品內可主動載入的示範資料

`POST /api/actions` 的 `seed` action 會為目前登入者寫入真正的 D1，但內容是專題自建的虛構資料：

- 「東京，慢慢走」：開始日為執行 seed 當天後 45 天，為期 5 天。
- 「台南的午後時光」：固定日期 2026-07-10 至 2026-07-12。
- 神農街足跡、示範心情日記、淺草行程與五項準備清單。

這些資料會實際進資料庫，使用者可以編輯或刪除；「假」指內容是示範故事，不代表它只存在前端記憶體。

### 其他測試／展示資料

- `tests/fixtures/tokyo-exif.jpg` 是測試程式產生的單色 JPEG，含人工寫入的 2026-01-02 與東京 GPS；不是使用者照片。
- 沒有照片的日本旅行會使用 Wikimedia Commons 的東京新宿照片作為卡片／空狀態示意圖。這是外部展示素材，不是該旅行的真實照片。
- 本機 auth 使用 Sites Vite plugin 的 mock authentication；正式環境不是這個 mock。
- `lib/cities.ts` 的城市中心點是小型離線近似資料集，不是權威行政區資料庫。

## 7. 已接真實 Database／API 的功能

| 功能 | D1 | R2 | 應用 API |
|---|---:|---:|---|
| 讀取目前使用者所有旅行資料 | 是 | 否 | `GET /api/data` |
| 旅行 CRUD | 是 | 刪除旅行時清照片 | `POST /api/actions` |
| 足跡 CRUD | 是 | 否 | `POST /api/actions` |
| 日記 CRUD | 是 | 否 | `POST /api/actions` |
| 行程 CRUD | 是 | 否 | `POST /api/actions` |
| 準備清單 CRUD／切換狀態 | 是 | 否 | `POST /api/actions` |
| 照片上傳 | metadata | 原始 bytes | `POST /api/photos` |
| 照片讀取／下載 | 驗證 metadata 與 owner | 原始 bytes | `GET /api/photos/:id` |
| 照片分類修正／刪除 | 是 | 刪除時同步刪物件 | `POST /api/actions` |
| 示範資料 | 寫入真實 D1 | 否 | `POST /api/actions` 的 `seed` |

前端沒有直接連 D1 或 R2，也沒有用 `localStorage`／`sessionStorage` 當權威資料來源。第三方網路服務只有 OpenStreetMap tile 與 Wikimedia 圖片；沒有第三方旅遊、訂位、地址或 AI API。

## 8. 資料模型與主要資料表

資料關係：平台使用者 `1 → N trips`；每個 trip `1 → N places / diaries / itinerary / tasks / photos`。使用者不是獨立資料表，`trips.user_id` 直接保存平台 user ID。

### `trips`

- `id` TEXT PK
- `user_id` TEXT NOT NULL，索引 `idx_trips_user`
- `title`、`country`、`city`
- `start_date`、`end_date`：`YYYY-MM-DD` 字串
- `description`，預設空字串
- `created_at`：ISO timestamp 字串

### `places`

- `id` TEXT PK、`trip_id` FK → `trips.id`，ON DELETE CASCADE
- `name`、`country`、`city`
- `lat`、`lng` REAL
- `date`
- `trip_id` 索引

### `diaries`

- `id`、`trip_id` FK
- `date`、`mood`、`title`、`body`
- ON DELETE CASCADE、`trip_id` 索引

### `itinerary`

- `id`、`trip_id` FK
- `date`、`time`、`category`、`title`、`note`
- `cost` REAL，預設 0
- ON DELETE CASCADE、`trip_id` 索引

### `tasks`

- `id`、`trip_id` FK
- `title`
- `done` INTEGER，0／1，預設 0
- ON DELETE CASCADE、`trip_id` 索引

### `photos`

- `id`、`trip_id` FK
- `object_key`：R2 object key，不會由 `/api/data` 傳到前端
- `filename`、`content_type`、`size`
- `date`、`city`
- `lat`、`lng` 可為 NULL
- `source`：分類依據說明
- `caption`
- ON DELETE CASCADE、`trip_id` 索引

目前 schema 沒有獨立 users 表、updated timestamp、soft delete、版本欄位、標籤表、分享表或 audit log。日期、enum 與多數長度限制主要由 Zod／API 維護，資料庫沒有對應 CHECK constraint。

## 9. 權限設計

- 未登入呼叫資料 API 會得到 401。
- `GET /api/data` 的主查詢以 `trips.user_id = current user ID` 篩選；子表透過 join 到 trips 再套同一 user ID。
- 寫入子資料前先用 `ownTrip(trip_id, userId)` 驗證旅行屬於目前使用者。
- 修改／刪除既有子紀錄時，同時要求 `id` 與已驗證的 `trip_id` 相符。
- 讀取照片時以 `photos JOIN trips` 驗證照片屬於目前使用者，再存取 R2 object key。
- 寫入 API 會拒絕 `Origin` 與目前 request origin 不同的請求；沒有另外實作 CSRF token。
- 所有 SQL value 使用 prepared statement bind。動態表名與欄位名只來自伺服器端固定 entity/schema 白名單。
- 沒有分享、共同編輯、管理員、editor、viewer 或公開資料概念；資料只按 owner user ID 隔離。
- R2 不是直接公開 bucket，照片只能經過已驗證的應用 endpoint 取得。
- 正式環境是否另外套用 Sites 層的 owner-only／allowlist：**無法只從應用原始碼確認**。

## 10. 錯誤處理

### Server

- `ApiError` 將預期錯誤映射為指定 HTTP status 與繁體中文 JSON error。
- Zod 驗證失敗統一回 400 與欄位格式提示。
- 未預期錯誤寫入 server console，回 500 泛化訊息，不把 stack trace 傳到前端。
- D1／R2 binding 缺失分別回 503。
- 文字 action 以 `Content-Length > 50000` 拒絕；照片 request 先以約 13 MB request 大小預檢，再檢查單檔 12 MB。
- 照片寫入順序為 R2 → D1；D1 insert 失敗時會嘗試刪掉剛寫入的 R2 object。
- 地圖 tile 載入錯誤會顯示警告，但既有足跡列表仍可使用。

### Client

- 共用 `request()` 讀 JSON，非 2xx 時丟出後端 `error` 或預設訊息。
- 資料載入和 mutation 都以 try/catch 顯示頁面或表單錯誤。
- mutation 期間用 `busy` 防止部分重複操作；成功後重新抓取完整資料。
- 多張照片逐張收集失敗檔名，最後顯示成功數與錯誤清單。
- 刪除前使用確認 dialog；旅行刪除文案說明會連帶刪除相關資料。

## 11. 已知 Bug／可確認問題

1. **手機長表單可能被裁切**：`dialog` 只有 `max-height: 90vh`，`.fields` 與 form 沒有內部 `overflow-y: auto`／flex scroll 區。旅行或足跡等長表單在低高度手機、虛擬鍵盤開啟或文字放大時，底部錯誤與儲存按鈕可能無法看見。
2. **API 非 JSON 錯誤會遮蔽真正原因**：前端 `request()` 無條件先執行 `r.json()`。若 proxy／平台回 HTML 或空回應，使用者會看到 JSON parse error，而不是一致的「操作失敗」訊息。
3. **多檔上傳不是原子操作**：前幾張成功後，後面某張失敗時，成功項目已保存在 D1/R2。UI 會報告部分成功，但沒有整批取消或重試佇列。
4. **刪除旅行的 D1/R2 操作不是交易**：程式先刪 R2，再刪 D1。R2 成功但 D1 delete 失敗時，D1 metadata 可能暫時指向不存在的物件。沒有背景 reconciliation job。
5. **大量資料會造成首頁與 mutation 變慢**：`GET /api/data` 一次回傳所有六類資料，且每次變更後全部重新下載。這在專題資料量可用，但會隨照片索引、日記和行程數量線性增加。
6. **日本旅行的無照片封面可能誤導**：只要國家文字等於「日本」且沒有使用者照片，就固定顯示東京新宿示意照，即使旅行城市不是東京。

目前自動測試沒有記錄其他失敗案例。Safari／iOS、Android Chrome、螢幕閱讀器、200% 文字放大與正式平台多帳號情境是否存在其他 bug：**未確認**。

## 12. 技術債與需要重構的地方

- `app/travel-app.tsx` 同時負責資料抓取、所有 mutation、搜尋、上傳、導航、四大畫面、詳情頁與全部表單；應拆成 feature components、hooks 和 API client。
- 多個 state、modal record 使用 `any`，降低重構與欄位變更時的型別保護。
- runtime 使用 raw SQL，但 schema 又以 Drizzle 維護，形成兩套資料存取表達；`db/index.ts` 目前未使用。應選定一致的 repository/data-access 策略。
- CRUD 以動態 SQL 拼欄位，雖然目前欄位來源受 schema 白名單限制，仍比明確 query 難審查與維護。
- 子表大多沒有 `created_at`／`updated_at`，GET 也未全面指定排序；未來同步、稽核與穩定分頁會困難。
- D1 與 R2 沒有交易邊界、補償佇列或孤兒物件清理工具。
- 照片沒有縮圖，列表直接讀原始檔；大量照片會增加頻寬與解碼成本。
- 搜尋、分組、統計與多數排序在 client 對全量資料運算，未設資料量界線。
- 原生 dialog 的 focus／scroll／mobile keyboard 行為缺少自動化瀏覽器測試。
- 依賴與 `components/ui` 模板範圍遠大於實際產品用量；應在確認無用途後縮減，降低安裝與維護面積。
- 目前只有一個初始 migration；缺少 migration CI、production schema drift 檢查與 rollback 策略。
- 錯誤只有 console 和使用者訊息，沒有 request ID、結構化 log、metrics 或告警。
- OSM public tile 直接用於產品；若流量增長，需要依使用政策評估專用 tile provider 或受控快取。
- 缺少 CI workflow；測試目前需人工／代理執行。

## 13. 下一步最合理的開發順序

1. **先修手機 dialog 與錯誤解析**：加入 `dvh`、表單內部捲動、sticky footer、鍵盤／文字放大測試；讓 `request()` 能處理非 JSON 錯誤。這是目前直接影響使用者完成操作的問題。
2. **完成真正的備份還原**：定義帶 schema version 的 export manifest、串流下載所有 R2 照片、匯入驗證、衝突策略與還原演練。版本控制不能取代使用者資料備份。
3. **改善照片管線**：產生縮圖、限制影像尺寸、分頁、失敗重試與孤兒 object 清理；再評估 HEIC 轉檔。
4. **補強 D1/R2 一致性**：加入 deletion job／outbox 或可重跑的 reconciliation，並記錄 object 狀態。
5. **把全量資料改為可分頁 API**：旅行摘要、詳情、相簿與日記分開載入；搜尋與排序移到 server。
6. **正式環境安全與權限驗證**：至少兩個真實測試帳號做隔離 E2E，加入 rate limit／quota、結構化 audit log，並確認 Sites access policy。
7. **重構前端與資料存取層**：拆分 `travel-app.tsx`、移除 `any`、統一 Drizzle 或明確 repository pattern、清理未使用依賴。
8. **提升地理資料品質**：建立標準 country/city ID；需要外部 geocoding 時先設隱私與配額，再保留人工確認。
9. **最後再加延伸功能**：照片轉足跡、分享／協作、行事曆同步或 AI 圖像標籤。這些不應早於備份、效能與權限基礎工作。

## 14. 目前驗證證據與未確認事項

儲存庫內可見：

- 8 項 domain tests：日期、狀態、旅行天數、統計與城市距離。
- 23 項本機 D1/R2 integration checks，最近寫入的結果在 `docs/test-results.json`。
- EXIF 測試會產生帶日期與東京 GPS 的 JPEG，並透過 API 驗證分類。
- `package.json` 提供 `typecheck`、`test`、`test:integration`、`test:exif` 與 `build` scripts。

仍未確認：

- 正式雲端資料庫目前實際資料量、migration revision 與 R2 object 一致性。
- 正式平台 session、access policy、備份與 retention 設定。
- 線上部署是否與目前 Git `main` 完全相同。
- 正式環境多帳號隔離的端到端測試結果。
- 壓力、滲透、無障礙、跨瀏覽器與使用者研究結果。

接手者在開始修改前，應先執行 `npm run typecheck`、`npm test`、`npm run build`。若要跑 integration／EXIF 測試，需先建立本機 D1、啟動本機服務，再執行相對應 script；這兩組測試會建立並清理測試旅行，不應直接對正式環境執行。
