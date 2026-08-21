@echo off
setlocal
title Daily Quest - Show My Site URL
cd /d "%~dp0"

echo.
echo ==================================================
echo   Looking up your site URL...
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [ERROR] Node.js not found.
  echo           Open https://app.netlify.com in your browser instead.
  echo.
  pause & exit /b
)

if not exist ".netlify\state.json" (
  echo   [ERROR] This folder is not linked to a Netlify site yet.
  echo           Run the SETUP .bat file first.
  echo.
  pause & exit /b
)

call netlify status

echo.
echo ==================================================
echo   Look above for the line:
echo.
echo       URL:   https://something.netlify.app
echo.
echo   That is your app address.
echo.
echo   To copy it: drag-select the text with the mouse,
echo               then press Enter.
echo.
echo   A browser tab will now open with your site,
echo   so you can also copy it from the address bar.
echo ==================================================
echo.
pause

call netlify open:site

echo.
echo   Remember: paste the address into  site-url.txt
echo.
pause
