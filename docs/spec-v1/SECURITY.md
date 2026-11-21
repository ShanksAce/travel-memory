# Travel Memory Security Design

## Security Goal
Travel Memory 保存個人旅行資料、照片與日記，因此使用者隱私與資料隔離是重要需求。

## 1. Authentication
應包含：
- Login
- Logout
- Session / Token Management
- Password Hashing

密碼禁止明文保存。

## 2. Authorization
登入並不等於擁有所有資料權限。

例如：
`GET /api/trips/128`

Backend 必須驗證該 Trip 是否屬於目前登入使用者，否則回傳 `403 Forbidden`。

## 3. Ownership Validation
必須套用於：
- Trip
- Photo
- Diary
- Itinerary
- Location
- Checklist

## 4. Frontend 不負責真正安全控制
隱藏按鈕不是安全措施。權限判斷必須位於 Backend。

## 5. Database Security
避免：
- SQL Injection
- Root Account Application Access
- Direct Client-to-Database Connection
- Password Exposure

建議架構：
Backend → ORM / Parameterized Query → Restricted Database User → Database

## 6. Database Integrity
使用：
- Foreign Key
- Unique Constraint
- NOT NULL
- Transaction

避免：
- Orphan Records
- Duplicate Records
- Inconsistent State

## 7. File Upload Security
圖片上傳必須檢查：
- MIME Type
- Extension
- File Size
- File Count

檔案名稱應重新產生，例如 UUID，而不是完全相信使用者提供的 Filename。

## 8. API Security
API 應具備：
- Authentication
- Authorization
- Validation
- Rate Limiting
- Error Sanitization

Production 不應直接回傳 Stack Trace、SQL Error、Database Credentials、Internal Path。

## 9. Secrets
Database Password、API Key、Secret Key、Storage Key、JWT Secret 不可寫死於 Frontend 或 Git。

應使用 Environment Variables 或 Secrets Management。

## 10. HTTPS
Production 敏感操作必須透過 HTTPS。

## 11. Backup
Database 應設計定期備份與 Restore Procedure。

## 12. Privacy
使用者資料預設私人。

若未來加入分享功能，需另外設計：
- Private
- Shared
- Public
