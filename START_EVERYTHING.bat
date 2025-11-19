@echo off
echo ============================================
echo Starting Audico AI System
echo ============================================
echo.
echo This will open THREE windows:
echo   1. Backend API (port 8000)
echo   2. Dashboard (port 3001)
echo   3. Email Worker (polls every 60s)
echo.
echo Press any key to continue...
pause > nul

echo.
echo Starting Backend...
start "Audico AI - Backend" cmd /k "cd /d "%~dp0" && uvicorn src.main:app --reload --port 8000"

timeout /t 3 /nobreak > nul

echo Starting Dashboard...
start "Audico AI - Dashboard" cmd /k "cd /d "%~dp0dashboard" && npx next dev -p 3001"

echo.
echo ============================================
echo Both services are starting!
echo ============================================
echo.
echo Backend:   http://localhost:8000
echo Dashboard: http://localhost:3001
echo API Docs:  http://localhost:8000/docs
echo.
echo Keep both windows open for the system to run.
echo Close this window now.
echo.
pause
