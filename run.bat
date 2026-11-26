@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not defined BACKEND_PORT set "BACKEND_PORT=5000"
if not defined FRONTEND_PORT set "FRONTEND_PORT=5173"

set "VPY=%~dp0backend\.venv\Scripts\python.exe"

if not exist "%VPY%" (
  echo [X] The backend environment is missing.
  echo     Run setup.bat first.
  echo.
  pause
  exit /b 1
)
if not exist "node_modules\vite\package.json" (
  echo [X] The frontend packages are missing.
  echo     Run setup.bat first.
  echo.
  pause
  exit /b 1
)

echo ============================================================
echo  FutureBug
echo ============================================================
echo  Backend : http://127.0.0.1:%BACKEND_PORT%
echo  Frontend: http://127.0.0.1:%FRONTEND_PORT%
echo.

rem ---------------------------------------------------------- backend port
call :portfree %BACKEND_PORT%
if errorlevel 1 (
  echo [X] Port %BACKEND_PORT% is already in use.
  echo     Close the other backend window, or start this one elsewhere:
  echo         set BACKEND_PORT=5001 ^&^& run.bat
  echo.
  pause
  exit /b 1
)

echo [..] Starting the backend in a new window
start "FutureBug backend" /D "%~dp0backend" "%VPY%" app.py --port %BACKEND_PORT%

echo [..] Waiting for the backend to answer /health
set /a TRIES=0
:wait_backend
"%VPY%" -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:%BACKEND_PORT%/health', timeout=2).read()" >nul 2>&1
if not errorlevel 1 goto backend_ready
set /a TRIES+=1
if %TRIES% GEQ 30 goto backend_timeout
ping -n 2 127.0.0.1 >nul
goto wait_backend

:backend_timeout
echo [!] The backend did not answer within 30 seconds.
echo     Check its window for an error; starting the frontend anyway.
goto start_frontend

:backend_ready
echo [ok] Backend is up

rem ---------------------------------------------------------- frontend port
:start_frontend
call :portfree %FRONTEND_PORT%
if not errorlevel 1 goto frontend_port_ok
set /a FRONTEND_PORT+=1
if %FRONTEND_PORT% GEQ 5200 (
  echo [X] No free frontend port between 5173 and 5199.
  echo     Close another dev server and try again.
  echo.
  pause
  exit /b 1
)
goto start_frontend

:frontend_port_ok
set "VITE_API_BASE_URL=http://127.0.0.1:%BACKEND_PORT%"

echo [..] Starting the frontend in a new window ^(port %FRONTEND_PORT%^)
start "FutureBug frontend" /D "%~dp0." cmd /k "npm run dev -- --host 127.0.0.1 --port %FRONTEND_PORT% --strictPort"

echo [..] Waiting for the frontend to answer
set /a TRIES=0
:wait_frontend
"%VPY%" -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:%FRONTEND_PORT%/', timeout=2).read()" >nul 2>&1
if not errorlevel 1 goto open_browser
set /a TRIES+=1
if %TRIES% GEQ 40 goto open_browser
ping -n 2 127.0.0.1 >nul
goto wait_frontend

:open_browser
start "" "http://127.0.0.1:%FRONTEND_PORT%/"

echo.
echo ============================================================
echo  FutureBug is running
echo    Frontend: http://127.0.0.1:%FRONTEND_PORT%
echo    Backend : http://127.0.0.1:%BACKEND_PORT%
echo  Close the two "FutureBug" windows to stop it.
echo ============================================================
echo.
ping -n 6 127.0.0.1 >nul
exit /b 0

rem ---------------------------------------------------------- helpers
rem Exits 0 when the port is free, 1 when something is already listening
rem (checked on both IPv4 and IPv6 loopback, since Vite may bind only one).
:portfree
"%VPY%" -c "import socket, sys; socket.setdefaulttimeout(0.4); free = lambda host: socket.socket(socket.AF_INET6 if ':' in host else socket.AF_INET).connect_ex((host, %~1)) != 0; sys.exit(0 if (free('127.0.0.1') and free('::1')) else 1)"
exit /b %errorlevel%
