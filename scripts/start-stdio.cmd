@echo off
REM ==========================================================================
REM  Anki MCP Server — STDIO launcher (Windows)
REM
REM  This launcher starts the MCP server in STDIO mode without relying on
REM  Node.js being in the system PATH. It auto-detects node.exe in common
REM  locations and falls back to the system PATH.
REM
REM  Usage:
REM    scripts\start-stdio.cmd              (default: localhost:8765)
REM    scripts\start-stdio.cmd --read-only  (read-only mode)
REM
REM  Environment variables (all optional):
REM    ANKI_CONNECT_URL    default: http://localhost:8765
REM    ANKI_CONNECT_TIMEOUT default: 5000
REM    LOG_LEVEL           default: info
REM    READ_ONLY           default: false
REM ==========================================================================

setlocal enabledelayedexpansion

REM --- Resolve project root (parent of this script's directory) ---
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
pushd "%PROJECT_ROOT%"
set "PROJECT_ROOT=%CD%"
popd

set "ENTRY=%PROJECT_ROOT%\dist\main-stdio.js"

REM --- Verify build exists ---
if not exist "%ENTRY%" (
  echo [ERROR] Build output not found: %ENTRY%
  echo         Run "npm run build" first to compile TypeScript.
  exit /b 1
)

REM --- Locate node.exe ---
set "NODE_EXE="

REM 1) Try system PATH
where node >nul 2>&1 && (
  for /f "delims=" %%i in ('where node') do (
    if not defined NODE_EXE set "NODE_EXE=%%i"
  )
)

REM 2) Try common Windows install locations
if not defined NODE_EXE (
  if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
)
if not defined NODE_EXE (
  if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"
)
if not defined NODE_EXE (
  if exist "%LOCALAPPDATA%\fnm_multishells\node.exe" set "NODE_EXE=%LOCALAPPDATA%\fnm_multishells\node.exe"
)
if not defined NODE_EXE (
  if exist "%USERPROFILE%\AppData\Roaming\nvm\node.exe" set "NODE_EXE=%USERPROFILE%\AppData\Roaming\nvm\node.exe"
)

REM 3) Allow override via NODE_PATH env var (point to node.exe directly)
if defined ANKIMCP_NODE_EXE (
  if exist "%ANKIMCP_NODE_EXE%" set "NODE_EXE=%ANKIMCP_NODE_EXE%"
)

if not defined NODE_EXE (
  echo [ERROR] Node.js was not found.
  echo         Options:
  echo           a^) Install Node.js v22+ from https://nodejs.org/
  echo           b^) Add your Node.js directory to the PATH
  echo           c^) Set ANKIMCP_NODE_EXE to the full path of node.exe
  exit /b 1
)

REM --- Set default env vars if not already set ---
if not defined ANKI_CONNECT_URL set "ANKI_CONNECT_URL=http://localhost:8765"
if not defined ANKI_CONNECT_API_VERSION set "ANKI_CONNECT_API_VERSION=6"
if not defined ANKI_CONNECT_TIMEOUT set "ANKI_CONNECT_TIMEOUT=5000"
if not defined LOG_LEVEL set "LOG_LEVEL=info"

REM --- Launch ---
"%NODE_EXE%" "%ENTRY%" %*

endlocal
