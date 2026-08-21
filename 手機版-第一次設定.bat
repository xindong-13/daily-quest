@echo off
setlocal
title Daily Quest - First Time Setup
cd /d "%~dp0"

echo.
echo ==================================================
echo   Daily Quest  -  First Time Setup
echo   (Chinese guide: read the .md file in this folder)
echo ==================================================
echo.

if not exist "index.html" (
  echo [ERROR] index.html not found.
  echo         Keep this .bat in the same folder as index.html
  echo.
  pause
  exit /b
)

rem ---------- Step 1: check Node.js ----------
where node >nul 2>nul
if errorlevel 1 goto NONODE

echo [1/4] Node.js found:
node -v
echo.

rem ---------- Step 2: install Netlify CLI ----------
echo [2/4] Installing upload tool (Netlify CLI)...
echo       First time takes 1-2 minutes. Please wait.
echo.
call npm install -g netlify-cli --loglevel=error
if errorlevel 1 goto NPMFAIL
echo       Done.
echo.

rem ---------- Step 3: login ----------
echo [3/4] Login to Netlify
echo       A browser window will open.
echo       Sign up / log in with Google, then click Authorize.
echo       Come back to this window when done.
echo.
call netlify login
echo.

rem ---------- Step 4: build + deploy ----------
echo [4/4] Preparing files...
call :BUILD
echo       Done.
echo.
echo --------------------------------------------------
echo   You will now be asked a few questions.
echo.
echo   Q: What would you like to do?
echo      - If this is your FIRST site:
echo          choose  [+]  Create ^& configure a new site
echo      - If you ALREADY uploaded before (drag ^& drop):
echo          choose  [^<-^>] Link this directory to an existing site
echo            then pick your site from the list
echo.
echo   Q: Team          -^>  just press Enter
echo   Q: Site name     -^>  type a short lowercase name
echo                        example:  jerry-daily
echo --------------------------------------------------
echo.
pause

call netlify deploy --prod --dir=".deploy"
if errorlevel 1 goto DEPLOYFAIL

echo.
echo ==================================================
echo   SUCCESS
echo.
echo   Look above for the line:   Website URL:
echo   That https://... address is YOUR app.
echo.
echo   1. Copy it  (select the text, then press Enter)
echo   2. Paste it into  site-url.txt  in this folder
echo   3. Open it on your iPhone using SAFARI
echo.
echo   Next time you only need:
echo      the OTHER .bat file (the update one)
echo ==================================================
echo.
pause
exit /b


:BUILD
if exist ".deploy" rmdir /s /q ".deploy"
mkdir ".deploy" >nul 2>nul
copy /y "index.html"    ".deploy\" >nul
copy /y "app.js"        ".deploy\" >nul
copy /y "style.css"     ".deploy\" >nul
copy /y "manifest.json" ".deploy\" >nul
copy /y "sw.js"         ".deploy\" >nul
xcopy "icons" ".deploy\icons\" /e /i /q /y >nul
exit /b


:NONODE
echo [ERROR] Node.js is not installed.
echo.
echo   1. A browser will open at https://nodejs.org
echo   2. Download the green LTS button
echo   3. Install (click Next on everything)
echo   4. RESTART YOUR COMPUTER
echo   5. Run this .bat again
echo.
pause
start "" https://nodejs.org
exit /b


:NPMFAIL
echo.
echo [ERROR] Could not install Netlify CLI.
echo         Try again: right-click this file -^> Run as administrator
echo.
pause
exit /b


:DEPLOYFAIL
echo.
echo [ERROR] Upload failed.
echo         Check your internet connection and try again.
echo         If it says you are logged out, run:  netlify login
echo.
pause
exit /b
