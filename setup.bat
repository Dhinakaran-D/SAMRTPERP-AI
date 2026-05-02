@echo off
REM SmartPrep AI - Windows Setup Script

echo.
echo ============================================
echo SmartPrep AI - Competitive Exam RAG Setup
echo ============================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/5] Python found: 
python --version
echo.

REM Create virtual environment
echo [2/5] Creating virtual environment...
if exist venv (
    echo Virtual environment already exists
) else (
    python -m venv venv
    echo Virtual environment created
)
echo.

REM Activate virtual environment
echo [3/5] Activating virtual environment...
call venv\Scripts\activate.bat
echo.

REM Install requirements
echo [4/5] Installing dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo.

REM Create folders
echo [5/5] Creating necessary folders...
if not exist uploads mkdir uploads
if not exist backend mkdir backend
if not exist frontend mkdir frontend
echo.

echo ============================================
echo Setup Complete!
echo ============================================
echo.
echo To start the application:
echo.
echo 1. Run the backend:
echo    cd backend
echo    python app.py
echo.
echo 2. Open frontend (in another terminal):
echo    Open frontend/index.html in your browser
echo.
echo 3. (Optional) For advanced LLM features, install Ollama:
echo    https://ollama.ai
echo    ollama pull mistral
echo.
pause
