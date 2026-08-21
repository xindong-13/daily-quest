@echo off
setlocal
title Daily Quest - Deploy To A Specific Site
cd /d "%~dp0"

echo.
echo ==================================================
echo   Deploy the latest version to a SPECIFIC site
echo   (use this to update your OLD phone address)
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [ERROR] Node.js not found.
  pause & exit /b
)

if not exist "index.html" (
  echo   [ERROR] index.html not found in this folder.
  pause & exit /b
)

echo   Type the site NAME (not the full address).
echo   Example:  sparkly-pastry-a1b2c3
echo.
echo   Not sure? Close this and run the LIST SITES .bat file.
echo.
set "SITE="
set /p SITE=  Site name:

if "%SITE%"=="" (
  echo.
  echo   [ERROR] No name entered.
  pause & exit /b
)

echo.
echo   Preparing files...
if exist ".deploy" rmdir /s /q ".deploy"
mkdir ".deploy" >nul 2>nul
copy /y "index.html"    ".deploy\" >nul
copy /y "app.js"        ".deploy\" >nul
copy /y "style.css"     ".deploy\" >nul
copy /y "manifest.json" ".deploy\" >nul
copy /y "sw.js"         ".deploy\" >nul
xcopy "icons" ".deploy\icons\" /e /i /q /y >nul

echo   Uploading to: %SITE%
echo.
call netlify deploy --prod --dir=".deploy" --site "%SITE%"
if errorlevel 1 goto FAIL

echo.
echo ==================================================
echo   DONE.
echo   On your phone: swipe the app fully closed,
echo   then reopen it. Settings should now show the
echo   cloud sync card.
echo ==================================================
echo.
pause
exit /b

:FAIL
echo.
echo   [ERROR] Upload failed.
echo           Check the site name is spelled correctly.
echo           Run the LIST SITES .bat file to see the exact name.
echo.
pause
exit /b
