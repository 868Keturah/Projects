@echo off
echo Starting DocCraft...
cd /d C:\Scripts\DocCraft
python -m http.server 8080
if %errorlevel% neq 0 (
    echo.
    echo Python not found. Trying py command...
    py -m http.server 8080
)
pause
