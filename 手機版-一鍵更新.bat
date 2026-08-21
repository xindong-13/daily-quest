@echo off
setlocal
title Daily Quest - Update Phone Version
cd /d "%~dp0"

echo.
echo   Uploading the latest version...
echo.

if not exist "index.html" (
  echo   [ERROR] index.html not found in this folder.
  pause & exit /b
)

where node >nul 2>nul
if errorlevel 1 (
  echo   [ERROR] Node.js not found.
  echo           Run the SETUP .bat file first.
  pause & exit /b
)

if not exist ".netlify\state.json" (
  echo   [ERROR] Not set up yet.
  echo           Run the SETUP .bat file first.
  pause & exit /b
)

if exist ".deploy" rmdir /s /q ".deploy"
mkdir ".deploy" >nul 2>nul
copy /y "index.html"    ".deploy\" >nul
copy /y "app.js"        ".deploy\" >nul
copy /y "style.css"     ".deploy\" >nul
copy /y "manifest.json" ".deploy\" >nul
copy /y "sw.js"         ".deploy\" >nul
xcopy "icons" ".deploy\icons\" /e /i /q /y >nul

call netlify deploy --prod --dir=".deploy"
if errorlevel 1 goto FAIL

echo.
echo   ==============================================
echo    DONE - uploaded.
echo.
echo    On your iPhone:
echo      swipe the app fully closed, then reopen it.
echo   ==============================================
echo.
pause
exit /b

:FAIL
echo.
echo   [ERROR] Upload failed.
echo           Network problem, or your login expired.
echo           If logged out, run this command:   netlify login
echo.
pause
exit /b
