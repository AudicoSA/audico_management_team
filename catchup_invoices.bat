@echo off
REM Catch-up script to process missed invoice emails from the last 7 days
REM This will process ALL emails from the last week, not just unread ones

echo ========================================
echo Invoice Email Catch-Up Script
echo ========================================
echo.
echo This will process all emails from the last 7 days
echo to catch up on missed supplier invoices.
echo.
pause

cd /d "%~dp0"

echo.
echo Running email processor with --all flag...
echo.

python process_invoice_emails.py --all --max 100

echo.
echo ========================================
echo Catch-up complete!
echo ========================================
echo.
pause
