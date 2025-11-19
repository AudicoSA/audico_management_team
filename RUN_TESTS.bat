@echo off
echo Running Audico AI Test Suite...
echo.

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Run tests with coverage
echo Running tests with coverage...
pytest tests/ -v --cov=src --cov-report=html --cov-report=term

echo.
echo Test run complete!
echo Coverage report available at: htmlcov/index.html
pause
