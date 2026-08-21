@echo off
setlocal
title Daily Quest - List My Netlify Sites
cd /d "%~dp0"

echo.
echo ==================================================
echo   Your Netlify sites
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [ERROR] Node.js not found.
  pause & exit /b
)

call netlify sites:list

echo.
echo ==================================================
echo   Look for the OLD site (the one your phone uses).
echo   Write down its NAME - the part before .netlify.app
echo.
echo   Example:
echo     sparkly-pastry-a1b2c3.netlify.app
echo     -^> the name is:  sparkly-pastry-a1b2c3
echo ==================================================
echo.
pause
