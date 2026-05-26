@echo off
echo Killing ClaudeCode Remote.exe if running...
taskkill /F /IM "ClaudeCode Remote.exe" >nul 2>&1

echo Building...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    exit /b 1
)

echo Building Windows package...
call electron-builder --win
if %ERRORLEVEL% NEQ 0 (
    echo Electron build failed!
    exit /b 1
)

echo Starting installer...
start "" ".\dist\claudecode-remote-1.0.0-setup.exe"
echo Done!
