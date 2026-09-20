# Travel Memory Security

本文件描述目前程式實際採用的安全模型，以及尚未完成的限制。

## 1. 信任邊界

```text
Browser
→ HTTPS
→ Cloudflare Worker / Vinext Route Handler
→ Session authentication
→ Origin / input validation
→ Ownership authorization
→ D1 / R2
```

前端隱藏按鈕不視為權限控制。所有私人旅行資料的存取都必須在後端重新驗證登入者與資源 ownership。

## 2. 帳號與密碼

獨立網站不再依賴 ChatGPT Sites authentication headers。

使用者資料存於 D1 `users`：
- `email`
- `display_name`
- `password_hash`
- `password_salt`
- `password_iterations`
- `created_at`

密碼處理：
- 使用 Web Crypto PBKDF2-SHA-256。
- 每位使用者使用獨立 16-byte random salt。
- 目前 iteration count 為 310,000。
- 資料庫不保存明文密碼。
- 登入比較使用固定時間式 byte comparison，降低直接字串比較的 timing leakage。

目前尚未實作：
- 忘記密碼／帳號救援
- Email ownership verification
- MFA / Passkey

因此正式對外商用前仍需補強帳號生命週期功能。

## 3. Session

登入成功後：
1. 產生 32-byte cryptographically random session token。
2. Browser 收到 token Cookie。
3. D1 只保存 token 的 SHA-256 hash，不保存原始 token。
4. 每次 API request 由 Cookie 找到 session 與 user。

Cookie：
- `HttpOnly`
- `SameSite=Lax`
- `Path=/`
- 30 天有效期
- HTTPS 正式環境使用 `Secure`

Logout 會刪除 D1 session 並讓 Browser Cookie 過期。

## 4. Login rate limiting

登入失敗使用「normalized email + client IP」的 SHA-256 雜湊作為限制鍵，不直接把 IP 寫入 `auth_attempts`。

目前規則：
- 15 分鐘視窗
- 5 次失敗後暫停登入
- 成功登入後清除該限制鍵

這是專題階段的應用層防護；若未來公開給大量使用者，應再搭配 Cloudflare WAF / rate limiting。

## 5. Authorization / IDOR

Trip 是主要 ownership boundary。

後端以：
```sql
SELECT * FROM trips WHERE id=? AND user_id=?
```
確認使用者擁有旅行。

Place、Diary、Itinerary、Task、Photo 等資源需透過所屬 Trip 驗證 ownership。知道別人的 resource ID 不應能讀取或修改其資料。

## 6. CSRF / Cross-origin writes

修改資料的 API 使用 Origin 檢查，拒絕非本站來源的跨網站寫入。

Session Cookie 使用 `SameSite=Lax`，作為額外瀏覽器層防護。

## 7. Database

正式資料庫為 Cloudflare D1。

原則：
- 應用程式不讓 Browser 直接連線 D1。
- Query 使用 D1 prepared statement + bind parameters。
- Schema / migration 版本保存在 `drizzle/`。
- GitHub deployment 透過 migration 套用 schema change。
- 高風險資料結構修改需先備份與確認。

## 8. Photo / R2

照片檔案存 R2，metadata 存 D1。

目前 API 會限制：
- 上傳 MIME / image signature
- 檔案大小
- 單次數量
- 使用者 ownership

R2 object key 不直接作為公開網址；照片由 authenticated API 讀取。

## 9. Secrets

不得提交：
- Cloudflare API Token
- Database credential
- API key
- Password
- Session token
- `.env*`

Cloudflare CI deployment 只從 GitHub repository secrets 取得：
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

API Token 應使用最小必要權限並限制到指定 Cloudflare account。

## 10. Error handling

對使用者不得回傳：
- SQL error
- stack trace
- internal file path
- secret

API 應回傳可理解訊息；未知錯誤只記錄 server log 並對 client 回傳一般錯誤訊息。

登入失敗使用「電子郵件或密碼不正確」避免直接透露密碼錯在哪裡。

## 11. Deployment

Production：
```text
GitHub main
→ CI verification
→ Cloudflare Workers deploy
→ D1 migration
→ Worker + D1 + R2
```

GitHub workflow 不會把 Cloudflare token 寫入 repository 或 log。

## 12. 尚未完成的正式商用安全項目

- Email verification
- Forgot password / account recovery
- MFA / Passkey
- Production WAF / managed rate limit policy
- Security headers 的完整 production audit
- Dependency / SCA 自動安全更新策略
- Backup restore drill
- Penetration testing
- Privacy policy / retention policy

在完成上述項目前，本專案應定位為可部署的資訊工程專題／個人使用版本，而不是已完成商用安全驗證的服務。
