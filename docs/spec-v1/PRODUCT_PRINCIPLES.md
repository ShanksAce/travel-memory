# Travel Memory Product Principles

## 1. Travel First
Travel Memory 首先是一個旅行產品。

不是 AI Demo。
不是 Chatbot Demo。
不是單純 CRUD Demo。

所有技術都必須服務旅行體驗。

## 2. AI Should Be Invisible When Possible
AI 可以存在，但不需要一直告訴使用者「這是 AI」。

好的智慧功能應該讓使用者感受到系統很聰明，而不是一直提醒使用者它有 AI。

## 3. AI 用來理解，不是取代使用者
推薦用途：
- 圖片辨識
- 照片分類
- 景點辨識
- 語意搜尋
- 相似照片
- 圖片資訊理解

不把以下內容作為主要產品特色：
- AI 自動寫旅行心得
- AI 大量生成日記
- AI 生成沒有個人意義的旅行文案

旅行回憶應該屬於使用者本人。

## 4. 完整產品 > 功能數量
功能完成的標準不是「按鈕可以按」。

真正完成應包含：
功能 → 正確結果 → Loading → Empty State → Error Handling → Permission → Security → Testing

## 5. Backend Security Cannot Depend on Frontend
Frontend 是使用者介面；Backend 才是真正的安全邊界。

## 6. Graceful Failure
服務失敗時不能直接白畫面。

例如地圖 API 無法使用時，使用者仍應能查看旅行資料。

## 7. No Fake Features
沒有真正完成的功能不能只做漂亮按鈕欺騙 Demo。

未完成功能應明確標示 Development / Planned。

## 8. Maintainability Matters
避免為了快速 Demo 製造：
- 巨型 Component
- Hard-coded Data
- 重複程式
- 混亂 API
- 無結構 Database
- 無文件程式碼

## 9. User Data Is Important
照片、遊記與旅行回憶對使用者具有長期價值，因此資料可靠性與資料安全和 UI 一樣重要。

## 10. Product Goal
最終成果應該讓人感覺：

「這是一個真的可以繼續開發並上線的產品。」

而不是：

「這是一個只為了專題發表而存在的網站。」
