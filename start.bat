@echo off
setlocal enabledelayedexpansion
title AutoBusiness AI

echo.
echo  Iniciando AutoBusiness AI...
echo.

docker-compose down --remove-orphans >nul 2>&1
docker-compose up -d
if errorlevel 1 ( echo [ERROR] docker-compose fallo & pause & exit /b 1 )

echo  Esperando base de datos...
:wait_db
docker-compose exec -T postgres pg_isready -U autobusiness >nul 2>&1
if errorlevel 1 ( timeout /t 2 /nobreak >nul & goto wait_db )
echo   OK PostgreSQL listo

echo  Esperando backend...
:wait_backend
curl -sf http://localhost:8080/api/health >nul 2>&1
if errorlevel 1 ( timeout /t 3 /nobreak >nul & goto wait_backend )
echo   OK Backend listo

echo  Esperando AI Engine...
:wait_ai
curl -sf http://localhost:8001/health >nul 2>&1
if errorlevel 1 ( timeout /t 2 /nobreak >nul & goto wait_ai )
echo   OK AI Engine listo

echo.
echo  ========================================
echo   AutoBusiness AI -- Sistema activo
echo  ========================================
echo   Frontend  ^>  http://localhost:3000
echo   Backend   ^>  http://localhost:8080/api
echo   AI Engine ^>  http://localhost:8001
echo.
echo   Demo: dueno@demo.com / demo123
echo  ========================================
echo.
pause
