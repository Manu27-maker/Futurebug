@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================================
echo  FutureBug - setup
echo ============================================================
echo  Installs the Python backend dependencies and the frontend
echo  Node packages on this machine. Run it once.
echo.

rem ---------------------------------------------------------- Python
set "PYTHON="
where py >nul 2>&1 && set "PYTHON=py -3"
if not defined PYTHON (
  where python >nul 2>&1 && set "PYTHON=python"
)
if not defined PYTHON (
  echo [X] Python was not found on PATH.
  echo     Install Python 3.11 or newer from https://www.python.org/downloads/
  echo     and tick "Add python.exe to PATH" during the install.
  goto end
)

%PYTHON% -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)"
if errorlevel 1 (
  echo [X] Python 3.11 or newer is required, found:
  %PYTHON% --version
  goto end
)
for /f "delims=" %%v in ('%PYTHON% --version 2^>^&1') do echo [ok] %%v

rem ---------------------------------------------------------- Node
where node >nul 2>&1
if errorlevel 1 (
  echo [X] Node.js was not found on PATH.
  echo     Install the LTS release from https://nodejs.org/ and reopen this window.
  goto end
)
where npm >nul 2>&1
if errorlevel 1 (
  echo [X] npm was not found on PATH.
  echo     Reinstall Node.js from https://nodejs.org/ - npm ships with it.
  goto end
)
for /f "delims=" %%v in ('node --version 2^>^&1') do echo [ok] Node %%v

rem ---------------------------------------------------------- backend venv
if exist "backend\.venv\Scripts\python.exe" (
  echo [ok] Backend virtual environment already present
) else (
  echo [..] Creating backend\.venv
  %PYTHON% -m venv backend\.venv
  if errorlevel 1 (
    echo [X] Could not create the virtual environment.
    goto end
  )
)

set "VPY=%~dp0backend\.venv\Scripts\python.exe"

echo [..] Updating pip
"%VPY%" -m pip install --upgrade pip --disable-pip-version-check --quiet
if errorlevel 1 echo [!] pip was not upgraded; continuing with the bundled version

echo [..] Installing backend requirements
"%VPY%" -m pip install -r backend\requirements.txt --disable-pip-version-check
if errorlevel 1 (
  echo [X] Installing backend requirements failed.
  goto end
)
echo [ok] Backend dependencies installed

rem ---------------------------------------------------------- frontend packages
echo [..] Installing frontend packages ^(npm install^)
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo [X] npm install failed.
  goto end
)
echo [ok] Frontend dependencies installed

echo.
echo ============================================================
echo  Setup complete.
echo  Double-click run.bat to start FutureBug.
echo ============================================================

:end
echo.
pause
exit /b 0
