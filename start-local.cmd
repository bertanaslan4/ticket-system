@echo off
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node scripts/build-server.js
  if errorlevel 1 exit /b 1
  node server/index.js
) else (
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts/build-server.js
  if errorlevel 1 exit /b 1
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server/index.js
)
pause
