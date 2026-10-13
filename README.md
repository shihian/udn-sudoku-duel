# UDN Sudoku Duel — 雙人連線數獨

GitHub Pages 靜態前端 + Supabase PostgreSQL/Auth 後端。好友房間、分享邀請 URL、9×9 同題、雙方準備、5 秒倒數、1.2 秒輪詢、先正確提交獲勝。

## 部署

1. 到 Repository → Settings → Pages → Source 選 **Deploy from a branch** → `main` / `(root)` → Save。
2. 建立自己的 Supabase Project，啟用 Authentication → Providers → **Anonymous sign-ins**。
3. 在 Supabase SQL Editor 執行 `schema.sql`。
4. 開啟網站，填入 **Project URL** 及 **publishable / anon key**，按「儲存並連線」。會記在此瀏覽器 localStorage；或填進 `config.js` 讓所有玩家不必自行設定。
5. 兩個瀏覽器／不同裝置測試：建立房間 → 邀請連結 → 加入 → 雙方準備 → 答完提交。

⚠️ **切勿公開 Supabase service_role 或 secret key。** `config.js` 只能放公開 key。

## 限制

好友試玩原型，未實測部署端兩位玩家並行；目前沒有反作弊、清理過期房間、速率限制。題目由後端產生有效解，但**尚未驗證唯一解**，不能用於獎品競賽。此版只有經典 9×9，算數變形版尚未加入。要真正連線，須設定 Supabase，GitHub Pages 單獨無法支援多人同步。
