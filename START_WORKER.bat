@echo off
echo ============================================
echo Starting Audico AI Email Worker
echo ============================================
echo.
echo This worker will poll Gmail every 60 seconds
echo and process new emails automatically.
echo.
echo Press Ctrl+C to stop the worker.
echo.
pause

cd /d "%~dp0"
python src\worker.py
