@echo off
echo ========================================
echo Starting Audico AI Server
echo ========================================
echo.

REM Activate virtual environment
REM call venv\Scripts\activate

REM Start the server
"%~dp0venv\Scripts\python.exe" -m src.main

pause
