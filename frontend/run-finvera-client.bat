@echo off
echo Starting Fintranzact Client...
echo.

REM Check if the exe exists
if exist "dist-electron\win-unpacked\Fintranzact Client.exe" (
    echo Found Fintranzact Client executable
    echo Starting application...
    echo.
    start "" "dist-electron\win-unpacked\Fintranzact Client.exe"
    echo Fintranzact Client started successfully!
) else (
    echo ERROR: Fintranzact Client.exe not found!
    echo Please run the build process first:
    echo   npm run electron:pack
    echo.
    pause
)