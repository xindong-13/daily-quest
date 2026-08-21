# 每日任務 → 搬到 GitHub Pages

資料夾裡的 `GitHub Pages 搬家指南.md` 是三個 App 共用的總說明。
**這一份是每日任務專用的**，按鈕名稱、確認清單都對應到你實際看到的畫面。照這份做就好。

---

## 可以搬嗎？可以，而且已經準備好了

我已經把 kotoba 那一套完整複製過來，並且驗證過在 GitHub Pages 的子目錄
（`https://你的帳號.github.io/daily-quest/`）底下所有檔案路徑都正確。

新增的檔案：

```
GitHub-第一次設定.bat     ← 只跑一次
GitHub-一鍵更新.bat       ← 以後每次更新都用這個
GitHub-用權杖登入.bat     ← 登入失敗時的備援
bump-version.ps1         ← 自動把版本號 +1
.gitignore  .nojekyll    ← 排除個人資料 / 讓 Pages 直接吃靜態檔
```

順便加了一個 **藍色「有新版本可以更新」提示列**（跟 kotoba 一樣），推新版之後手機打開就會跳出來，點一下就更新，不用再手動滑掉重開。

---

## ⚠️ 最重要：你的資料在哪裡

| 東西 | 存在哪 | 換網址會怎樣 |
|---|---|---|
| 任務、紀錄、目標 | **Supabase 雲端**（你已經設好） | ✅ 新網址登入就會拉回來 |
| 同上的本機副本 | 瀏覽器的 `jerry-daily.netlify.app` | ❌ 新網址讀不到 |
| Supabase 網址與金鑰 | 瀏覽器 | ❌ 新網址要重貼一次 |

**所以搬家 = 在新網址重新設定一次雲端同步，資料自己就回來了。**
但還是要先備份，這是不依賴任何服務的保險。

---

# 步驟

## 步驟 0｜先備份（3 分鐘，不要跳過）

**在電腦上，用你現在的舊網址** `https://jerry-daily.netlify.app` 打開 App：

1. **⚙️ 設定 → ☁️ 雲端同步 → 🔄 立即同步**
   確認狀態列是綠色 **「● 已同步」**。這代表雲端已經是最新的
2. **⚙️ 設定 → 備份與還原 → 📋 複製成文字**
   點「複製全部」，貼到記事本存起來
3. 再按一次 **⬇ 匯出檔案**，把 JSON 存進資料夾裡的 `backups/`

> 步驟 1 是關鍵。雲端是最新的話，新網址登入就什麼都有了。
> 步驟 2、3 是保險，萬一雲端出問題也救得回來。

## 步驟 1｜跑第一次設定（5 分鐘）

雙擊 **`GitHub-第一次設定.bat`**，跟著畫面走：

| 畫面 | 你要做什麼 |
|---|---|
| `[1/6] git found` | 沒裝的話會自動開 git-scm.com。**裝完要重新執行這支 bat** |
| `[2/6] Installing GitHub CLI` | 自動安裝，等 1～2 分鐘 |
| `[3/6] GitHub login` | 瀏覽器會開。選 `GitHub.com` → `HTTPS` → `Login with a web browser` |
| `[4/6] Repository name` | **直接按 Enter**，用預設的 `daily-quest` |
| `[5/6] Uploading files` | 自動 |
| `[6/6] Turning on GitHub Pages` | 自動 |

跑完會顯示你的新網址，也會存進 `github-url.txt`：

```
https://你的帳號.github.io/daily-quest/
```

> **第一次建置要等 1～2 分鐘**，馬上打開如果是 404，等一下重整就好。

## 步驟 2｜把資料弄到新網址（3 分鐘）

用瀏覽器打開新網址。**畫面會是空的，這是正常的**（新網址 = 全新的瀏覽器空間）。

**最快、一定成功的做法（不碰 Supabase）：**

1. 另開一個分頁到**舊網址** `https://jerry-daily.netlify.app`
2. ⚙️ 設定 → 備份與還原 → **📋 複製成文字** → **複製全部**
3. 切到**新網址**那個分頁 → ⚙️ 設定 → 備份與還原 → **📥 從文字還原** → 貼上 → 還原

✅ 你的 16 件事、4 個目標、所有紀錄全部回來了。

**接著再設雲端同步**（照 `雲端同步設定教學.md`）：
建表語法 → Supabase 跑一次 → 回 App 貼網址金鑰 → 產生代碼 → 連線。

## 步驟 3｜逐項確認（2 分鐘）

打開新網址，一項一項對：

- [ ] **今日** — 任務列表跟舊的一樣
- [ ] **行事曆** — 週檢視看得到「游泳」「健身」「保養」在正確的星期
- [ ] **事情** — 共 16 項，重要程度的顏色都對
- [ ] **成績** — 完成率和「每件事的成績單」有數字，不是空的
- [ ] **目標** — 看20本書 14/20、股票 288030/500000 都在
- [ ] **設定** — 最下面顯示版本 `dq-v12`，雲端同步是綠色的

有任何一項不對就停下來，先別動手機，跟我說。

## 步驟 4｜手機換過去（3 分鐘）

**確認步驟 3 全部打勾之後才做這步。**

1. iPhone 用 **Safari** 打開新網址
2. 下方 **分享** → **加入主畫面** → 加入
3. 點開新圖示 → **⚙️ 設定 → ☁️ 雲端同步** → 貼上**一模一樣的** Project URL、anon key、
   **同步代碼**（電腦那一組，不要按產生新的）→ **連線** → 選 **用雲端這份**
4. 確認資料都在

## 步驟 5｜刪掉舊的（很重要）

新的確認沒問題之後：

1. **iPhone 長按舊圖示 → 移除 App**

   > 這步一定要做。兩個圖示留著，哪天不小心點到舊的，就會在舊 App 上累積進度，
   > 兩邊資料從此分岔。（不過因為兩邊都連同一個 Supabase，其實還是會同步，
   > 但版本會混亂，不如乾脆刪掉。）

2. 舊的 Netlify 站台**先留一週**當保險，確定都正常再去 app.netlify.com 刪掉

3. 之後這幾支 Netlify 的 bat 就用不到了，可以刪：
   `手機版-第一次設定.bat`、`手機版-一鍵更新.bat`、`上傳到指定站台.bat`、
   `列出我的所有站台.bat`、`顯示我的網址.bat`、`網址.txt`

4. 把 `site-url.txt` 裡的網址換成新的 GitHub 網址，桌面捷徑就會開新的

---

# 之後怎麼更新

**雙擊 `GitHub-一鍵更新.bat`**，它會：

1. 自動把 `sw.js` 和 `index.html` 的版本號 `dq-vN` → `dq-vN+1`
2. commit 並 push
3. GitHub 約 1 分鐘後重新建置

然後**打開 App，點下方藍色的「✨ 有新版本可以更新」→ 立即更新**。
沒跳出來就把 App 滑掉重開。

**沒有次數限制**，想更新幾次都可以。

---

# 隱私確認

`.gitignore` 已經設好，這些**不會**上傳到公開 repo：

```
backups/          ← 你的個人備份 JSON
*.json            ← 任何備份檔（!manifest.json 例外）
.netlify/  .deploy/  node_modules/
```

我實際模擬過一次 git 提交，確認 `backups/` 確實被排除。

**程式碼本身沒有任何秘密**——Supabase 的網址和金鑰是你在 App 畫面裡輸入、
存在瀏覽器裡的，不在程式碼中。我也掃過一遍確認沒有硬寫的金鑰。

第一次上傳完，可以去 `https://github.com/你的帳號/daily-quest`
自己看一眼，確認沒有 `backups` 資料夾。

---

# ⚠️ 同步方式已改成「同步代碼」，不再需要密碼

底下這一整段「忘記密碼」已經**用不到了**。雲端同步改成跟 Kotoba、Echo 一樣的
**同步代碼**做法：產生一組代碼，兩台裝置填同一組就同步，沒有帳號也沒有密碼。

**新的做法看 `雲端同步設定教學.md`。** 重點：

1. App → 設定 → 雲端同步 → **📋 顯示要貼到 Supabase 的建表語法** → 複製
2. Supabase → SQL Editor → 貼上 → Run（建一張新表 `daily_sync`）
3. 回 App 貼上 Project URL、anon key → **🎲 產生新代碼** → **連線**
4. 手機填**一模一樣的三樣東西** → 連線 → 選「用雲端這份」

舊的 `app_state` 表和那個登不進去的帳號**可以完全不管**，放著不會影響任何事。
（真的想清掉的話，SQL Editor 跑 `drop table if exists public.app_state;` 就好。）

<details>
<summary>（舊版留存：忘記密碼怎麼辦）</summary>

# 忘記密碼／登不進去

**先放心：你的資料不會因為密碼而消失。** 任務紀錄存在 Supabase 的 `app_state` 資料表裡，
跟密碼是分開的兩件事。密碼只是拿資料的鑰匙，換一把就好。

## ⛔ 絕對不要做的事

**不要在 Supabase 刪掉使用者。**
資料表設了 `on delete cascade`，刪掉帳號會**連你的任務資料一起刪掉**。

## 先確認錯誤訊息是什麼

App 的狀態列會寫原因，不同原因處理方式不一樣：

| 訊息 | 意思 | 怎麼辦 |
|---|---|---|
| `Invalid login credentials` | 帳號或密碼不對 | 往下做「重設密碼」 |
| `Email logins are disabled` | Email 登入被關掉了 | Authentication → Sign In / Providers → Email → 打開 **Enable Email provider** |
| `同步失敗 401` | anon key 貼錯或不完整 | 重新整串複製一次 |
| `需要先驗證信箱` | Confirm email 還開著 | 把它關掉 |

## 步驟 1｜先確認資料真的在雲端

Supabase → **SQL Editor** → New query，貼上執行：

```sql
select
  user_id,
  updated_at,
  jsonb_array_length(data->'tasks') as 任務數,
  jsonb_array_length(data->'goals') as 目標數
from public.app_state;
```

看到一列、任務數 16 左右 → 資料好好的，繼續下一步。

## 步驟 2｜確認你註冊的信箱到底是哪一個

Supabase → **Authentication** → **Users**，看清單裡那一列的 Email。
很可能只是打錯字（例如少一個字母、或用了另一個信箱）。

**如果信箱其實是對的，只是密碼記錯了**，做步驟 3。

## 步驟 3｜直接重設密碼（最可靠，不用收信）

Supabase → **SQL Editor** → New query，把兩個地方換成你的，然後 Run：

```sql
update auth.users
set encrypted_password = extensions.crypt('新密碼至少六個字', extensions.gen_salt('bf'))
where email = 'jerry051194@gmail.com';
```

- 把 `新密碼至少六個字` 換成你要用的新密碼（保留單引號）
- 把信箱換成步驟 2 看到的那一個

看到 `Success. 1 row(s) affected` 就成功了。回 App 用新密碼登入。

> 為什麼不用「寄重設信」：那個要另外設定轉址網址，比較容易卡住。直接改最快。

## 步驟 4｜還是不行的話（保底方案）

用新的信箱重新註冊一個帳號，再把舊資料搬過去：

1. App 裡用新信箱**註冊**（例如 `jerry051194+dq@gmail.com`，Gmail 的 `+` 別名會寄到同一個信箱）
2. 註冊完會建立一列空資料
3. Supabase → SQL Editor 執行（把兩個信箱換成你的）：

```sql
-- 把舊帳號的資料複製到新帳號
update public.app_state new_row
set data = old_row.data,
    updated_at = now()
from public.app_state old_row
where new_row.user_id = (select id from auth.users where email = '新信箱')
  and old_row.user_id = (select id from auth.users where email = '舊信箱');
```

4. 回 App 按 **🔄 立即同步**

## 完全不想碰 SQL 的話

你的資料還有另外兩份，不需要雲端也能全部救回來：

1. **步驟 0 存的備份文字** → 設定 → **📥 從文字還原**
2. **`backups/每日任務備份_2026-08-15.json`** → 設定 → **⬆ 匯入檔案**

先還原、照常用，密碼之後再處理。還原完之後記得在**資料最完整的那一台**
按 **⬆ 以這台為準**，把雲端也蓋成正確的版本。

</details>

---

# 卡住的時候

| 狀況 | 怎麼辦 |
|---|---|
| Git not installed | 去 git-scm.com 裝，**裝完重新開機**再跑 bat |
| winget 裝不了 GitHub CLI | 去 cli.github.com 手動裝，然後重跑 bat |
| 登入出現 503 | GitHub 暫時的問題。重跑 bat；連續失敗就用 `GitHub-用權杖登入.bat` |
| 網址 404 | 建置還沒好，等 1～2 分鐘重整 |
| 超過 5 分鐘還 404 | GitHub repo → Settings → Pages，確認 Source 是 `main` / `/ (root)` |
| push 失敗說沒權限 | 命令列執行 `gh auth login` 重新登入 |
| 新網址打開是空的 | 正常。做步驟 2 接回雲端 |
| 接回雲端後資料還是不對 | 別急著動手機。用步驟 0 存的備份文字，設定 → **📥 從文字還原** |
| 手機沒跳更新提示 | 滑掉重開；GitHub 建置要 1 分鐘，太快檢查看不到 |

任何一步卡住就截圖給我。
