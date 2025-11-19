@echo off
echo ========================================
echo Starting Audico AI Server
echo ========================================
echo.

REM Activate virtual environment
call venv\Scripts\activate

REM Start the server
python -m src.main

pause
