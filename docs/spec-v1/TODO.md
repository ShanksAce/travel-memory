# Travel Memory TODO

## Priority 0 — 確認目前實作狀態
需要從現有 Travel Memory 本機 Work 專案確認：
- Frontend Framework
- Backend Framework
- Database
- Authentication
- Storage
- Hosting
- Map Service
- API
- 已完成頁面
- 已完成功能
- Mock Data
- 真實 Database Data
- 已知 Bug

完成後更新所有文件。

## Priority 1 — 核心產品
確認或完成：
- 世界地圖
- 旅行管理
- 照片
- 日記
- 心情
- 未來旅行
- 行程
- 出發倒數

## Priority 2 — Database
建立正式資料模型：
- User
- Trip
- Location
- Photo
- Diary
- Itinerary
- Checklist

確認 Relationship、Foreign Key、Constraint、Cascade 行為。

## Priority 3 — Authentication
- Register
- Login
- Logout
- Password Hash
- Session / Token

## Priority 4 — Authorization
確保 User A 無法查看、修改、刪除 User B 的 Trip、Photo、Diary 等私人資料。

## Priority 5 — Photo Pipeline
Upload → Validation → Metadata Extraction → EXIF → GPS → Geocoding → Storage → Database

## Priority 6 — Intelligent Photo Organization
- Image Classification
- Semantic Tag
- Landmark Recognition
- Similar Photo Detection

AI 功能不影響核心功能是否能正常使用。

## Priority 7 — Error Handling
- Network Error
- Server Error
- Upload Error
- Validation Error
- Permission Error
- Not Found
- External API Failure

每種 Error 應有對應 UI。

## Priority 8 — UX
- Loading State
- Empty State
- Error State
- Success Message
- Confirmation
- Retry
- Responsive Design

## Priority 9 — Security
- Ownership Check
- Input Validation
- SQL Injection Protection
- File Security
- Rate Limit
- Secret Management
- HTTPS
- Database Backup

## Priority 10 — Testing
Functional：
- Create Trip
- Update Trip
- Delete Trip
- Upload Photo
- Create Diary

Permission：
- User A cannot access User B data

Failure：
- API Down
- Network Down
- Invalid Image
- Oversized Image
- Missing Trip

## Priority 11 — Final Product
- UI Polish
- Animation
- Performance
- Mobile Layout
- Browser Compatibility
- Deployment
- Documentation
- Demo Script
- Presentation
