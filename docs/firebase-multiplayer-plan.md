# Firebase 多人房間遷移規格（實作中，尚未上線）

## 現況
- 正式 GitHub Pages 仍使用 PeerJS/WebRTC。不可把已加入 Firebase 設定檔誤認為連線切換成功。
- Firebase: sudoku-universe-b766a，Realtime Database 位於 asia-southeast1，匿名 Authentication 已由使用者啟用。
- Database Rules 仍鎖定 read/write=false。**切勿為了測試將根節點改為 true**。
- 網頁為原生 JS，沒有 bundler；使用 Firebase modular CDN SDK。
- 不建立第二個公開正式網址來誤導使用者；先完成測試與權限驗證。

## 資料結構（v1）
```json
{
  "rooms": {
    "<unguessable-room-id>": {
      "hostUid": "<firebase-auth-uid>",
      "status": "waiting",
      "createdAt": 0,
      "updatedAt": 0,
      "boardSize": "3",
      "variant": "classic",
      "difficulty": "easy",
      "startAt": null,
      "challenge": null,
      "winnerUid": null,
      "members": {
        "<firebase-auth-uid>": {
          "name": "玩家",
          "ready": false,
          "filled": 0,
          "finished": false,
          "time": null
        }
      }
    }
  }
}
```

## 權限原則
1. 必須通過 Firebase 匿名 Authentication 才能讀取指定房間；不能列出 /rooms。
2. 房間 ID 必須不可猜測（crypto.randomUUID 或至少 128 bits 隨機），不是玩家姓名或短碼。
3. 只有建立房間的 uid 可變更 status、challenge、startAt、winnerUid；hostUid 建立後不可變更。
4. 成員只能建立自己的 member 節點，更新自己的 ready、filled；不得修改他人節點。
5. 房間最多 8 位成員，資料型別、欄位與數值範圍需要 rules.validate 限制。
6. 不得在未完成驗證前允許成員直接設定 finished/time 或 winnerUid。
7. 房主驗證答案仍是休閒玩法：因答案會傳到前端供提示顯示，不能宣稱防作弊。
8. 需有過期房間清理方案。RTDB 不會因網頁關閉自動刪除整個房間；onDisconnect 可處理 presence，但不是 TTL。
9. 多人同時加入與準備必須使用 transaction，避免覆寫其他玩家資料。
10. 安全規則與程式應一起測試，至少測試匿名登入、無權讀取、房主／成員越權、9 人加入、重新整理／斷線重連。

## 開發驗收門檻
- 同一台電腦兩個獨立瀏覽器，跨裝置與不同網路的實際驗證；自動化只能驗證其中一部分。
- 單人 3×3、9×9、關卡下拉、灰字答案與提示維持正常。
- 房主建立、邀請連結、2–8 人加入、全員準備、倒數、同題、同步進度、完成與再戰。
- 在 Firebase Rules 保持鎖定時不得切換正式版；驗證通過後才發布最小權限 rules。

## 部署策略
將 Firebase 版放在獨立的測試分支，避免半成品破壞正式遊戲。正式頁面不得載入未完成的 Firebase 模組。
