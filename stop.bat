@echo off
title Shagun ERP — Stopping...
cd /d "D:\Shagun CRM"

echo Stopping containers...
docker compose down

echo.
echo Done. Containers stopped.
pause
