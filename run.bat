@echo off
title DAI Dubber Pro - Launcher
color 0B

echo ==========================================================
echo               DAI DUBBER PRO - LAUNCHER
echo ==========================================================
echo.
echo [1/3] Starting Python FastAPI Backend Server...
start "DAI Dubber Pro - Backend API" cmd /k "echo Starting Backend on Port 8000... && cd /d %~dp0 && venv\Scripts\python.exe backend\main.py"

echo.
echo [2/3] Starting Next.js React Frontend...
start "DAI Dubber Pro - Next.js UI" cmd /k "echo Starting UI on Port 3000... && cd /d %~dp0 && npm run dev"

echo.
echo [3/3] Waiting for servers to initialize...
timeout /t 5 /nobreak > nul

echo.
echo Launching Web Browser at http://localhost:3000...
start http://localhost:3000

echo.
echo ==========================================================
echo   System is running! 
echo   - Backend: http://localhost:8000
echo   - Frontend: http://localhost:3000
echo   Keep this launcher window open or close it as you wish.
echo ==========================================================
pause
