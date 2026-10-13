# Cloudflare Rooms Backend (準備階段)

這是用來替代 PeerJS 的 Cloudflare Worker + Durable Object 房間服務草稿；目前**沒有部署**，GitHub Pages 仍在使用 PeerJS。請勿將此目錄視為已可使用的線上多人功能。

## 部署前必要事項

1. 取得 Cloudflare 帳號授權；以 Wrangler 登入並部署。
2. 由實際 Workers 網址配置前端 API / WebSocket，**再切換前端**，不要直接改壞現行單人模式。
3. 在正式環境完成兩個不同網路及 macOS/Windows/手機的連線、2–8 人、斷線、重連、同步開局與勝負驗收。
4. 補強正式安全：伺服器產生／驗證數獨、限制訊息速率、管理房間存活與恢復；目前 host 傳入答案僅供好友娛樂原型。

API 草稿：POST /rooms 建立房間取得 roomId/hostKey；GET /rooms/:roomId/ws WebSocket（房主使用 hostKey）。

**尚未完成**：前端切換、Cloudflare 實際部署、真實跨網路 QA。現有 GitHub Pages 仍保持不變。
