# 三個 App 搬到 GitHub Pages — 搬家指南

## 為什麼要搬

Netlify 2026 改成點數制：免費每月 300 點、**正式部署一次 15 點**、**點數整個帳號共用**，用完的話**所有站台一起暫停**。等於一個月只有約 20 次更新，三個 App 分。

GitHub Pages 沒有每月部署上限（只限每小時 10 次），頻寬 100 GB／月，完全免費。缺點只有一個：**免費帳號的 repository 必須是公開的**。你的程式碼公開沒關係——AI 金鑰和學習進度都存在瀏覽器裡，不在程式碼裡。

---

## ⚠️ 最重要的一件事：先備份，再搬

**換網址等於換一個全新的 App。**瀏覽器的資料是綁在網域上的，`xxx.netlify.app` 存的東西，`xxx.github.io` 讀不到。

所以 **開工前先做這件事**，三個 App 都做：

| App | 怎麼備份 |
|---|---|
| **Echo 英語** | 我的 → 備份與資料 → 📋 複製備份碼（`ECHO1:` 開頭）→ 貼到備忘錄 |
| **每日任務** | 設定 → 備份 → 複製備份碼 → 貼到備忘錄 |
| **コトバ Kotoba** | 還沒開始用，沒有資料要備份 |

> 有開雲端同步的話，新網址填一樣的同步代碼就會自動把資料拉回來。**但還是建議先複製備份碼**，這是不用依賴任何服務的保險。

---

## 搬家步驟（每個資料夾各做一次）

### 步驟 1｜跑第一次設定

在資料夾裡按兩下 **`GitHub-第一次設定.bat`**，跟著畫面走：

1. **檢查 Git** — 沒裝會幫你開 git-scm.com。裝完**要重新執行這支 bat**
2. **安裝 GitHub CLI** — 自動用 winget 裝。失敗的話會開 cli.github.com 讓你手動裝
3. **登入 GitHub** — 沒帳號的話在這步註冊，免費。選 `GitHub.com` → `HTTPS` → `Login with a web browser`
4. **輸入 repository 名稱** — 直接按 Enter 用預設就好：

   | 資料夾 | 預設名稱 | 你的網址會是 |
   |---|---|---|
   | コトバ Kotoba | `kotoba` | `https://你的帳號.github.io/kotoba/` |
   | Echo 英語 | `echo-english` | `https://你的帳號.github.io/echo-english/` |
   | claude for daily app | `daily-quest` | `https://你的帳號.github.io/daily-quest/` |

5. 上傳、開啟 Pages，完成後會自動幫你開網址，也會存進 `github-url.txt`

> **第一次建置要等 1～2 分鐘。**馬上打開如果是 404，等一下再重新整理。

### 步驟 2｜手機加到主畫面

iPhone 用 **Safari** 打開新網址 → 下方**分享** → **加入主畫面**。

### 步驟 3｜把進度還原回來

打開新的 App → 備份與資料 → **📥 貼上備份碼還原** → 貼上你在步驟 0 存的那串。

有雲端同步的話，改成填一樣的 Supabase 設定和同步代碼，按「立即同步」也可以。

### 步驟 4｜確認資料都在，然後刪掉舊圖示

**這步很重要。** 兩個圖示留在主畫面上，你哪天不小心點到舊的，就會在舊 App 上累積進度，兩邊資料從此分岔，救不回來。

確認新 App 的進度、錯題本、設定都對了之後，**長按舊圖示 → 刪除**。

### 步驟 5｜舊的 Netlify 站台

先留著一週當保險。確定新的都正常之後，去 app.netlify.com 把站台刪掉，桌面上那幾支 Netlify 的 bat 也可以刪了。

---

## 之後怎麼更新

按兩下 **`GitHub-一鍵更新.bat`**，它會：

1. 自動把 `sw.js` 的版本號 +1（Kotoba 是 `kotoba-vN`、Echo 是 `echo-vN`、每日任務是 `dq-vN`，三種寫法都認得）
2. commit 並 push 到 GitHub
3. GitHub 約 1 分鐘後重新建置完成

然後手機打開 App，點下方藍色的更新提示。沒跳出來就把 App 滑掉重開。

**沒有次數限制**，想更新幾次都可以。

---

## 隱私：哪些檔案不會被上傳

設定 bat 會自動建一個 `.gitignore`，排除掉：

```
.deploy/          建置暫存
.netlify/         Netlify 的設定
node_modules/
backups/          ← 你的個人備份 JSON
*backup*.json     ← 同上
```

> **每日任務的 `backups/` 資料夾裡有你的個人任務資料**，這個一定要擋掉，不然會出現在公開 repo 上。已經處理好了，但第一次上傳完可以自己去 GitHub 頁面確認一下那個資料夾沒有出現。

---

## 卡住的時候

| 狀況 | 怎麼辦 |
|---|---|
| Git not installed | 去 git-scm.com 裝，裝完重跑 bat |
| winget 裝不了 GitHub CLI | 去 cli.github.com 手動下載安裝，然後重跑 bat |
| 網址 404 | 建置還沒好，等 1～2 分鐘再重整 |
| 一直 404 超過 5 分鐘 | 去 GitHub repo → Settings → Pages，確認 Source 是 `main` / `/ (root)` |
| push 失敗說沒權限 | 執行 `gh auth login` 重新登入 |
| repo 名稱已存在 | bat 會自動改成推到現有的 repo，通常沒問題 |
| 手機沒跳更新提示 | 把 App 滑掉重開；GitHub 建置要 1 分鐘，太快檢查會看不到 |
| 進度不見了 | 你在新網址上，資料本來就是空的。貼備份碼還原 |
