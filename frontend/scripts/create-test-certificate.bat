@echo off
echo Creating self-signed certificate for Fintranzact Client...
echo.
echo This script will create a test certificate for code signing.
echo IMPORTANT: This is for TESTING only - users will still see warnings!
echo.
pause

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Running as Administrator - Good!
    echo.
) else (
    echo WARNING: Not running as Administrator
    echo Some operations may fail. Consider running as Administrator.
    echo.
)

REM Run PowerShell script
powershell -ExecutionPolicy Bypass -File "create-test-certificate.ps1"

echo.
echo Certificate creation completed!
echo Check the output above for any errors.
echo.
pause