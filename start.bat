@echo off
title Shagun ERP — Starting...
cd /d "D:\Shagun CRM"

echo [1/4] Starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

echo [2/4] Waiting for Docker engine...
:wait
timeout /t 5 /nobreak >nul
docker ps >nul 2>&1
if errorlevel 1 goto wait

echo [3/4] Starting containers...
docker compose up -d

echo.
echo [4/4] Shagun ERP is running!
echo     Frontend : http://localhost
echo     Backend  : http://localhost:8000
echo.
start http://localhost
pause
