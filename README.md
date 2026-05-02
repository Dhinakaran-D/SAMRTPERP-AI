# SmartPrep AI

SmartPrep AI is a local, web-based exam preparation tool that ingests PDFs and generates MCQs with analytics and assessment views.

## Features
- PDF upload and document management
- MCQ generation by topic and difficulty
- Dashboard and analytics views
- Assessment workflow (practice, exam, assessment)
- Online mode (Gemini) and offline mode (Ollama) for MCQ generation

## Requirements
- Python 3.10+
- Windows PowerShell (for scripts)

## Quick Start
1) Install dependencies:
   - Run `setup.bat`, or
   - Create a virtual environment and run `pip install -r requirements.txt`
2) Start backend:
   - `cd backend`
   - `python app.py`
3) Open frontend:
   - Open `frontend/index.html` in your browser

## API Overview
Base URL: `http://localhost:5000/api`
- `GET /health`
- `GET /mode`
- `POST /mode`
- `POST /upload-pdf`
- `POST /generate-mcqs`
- `GET /documents`
- `POST /clear-database`

See API_EXAMPLES.md for requests.

## Configuration
- `.env` holds runtime configuration.
- `.env.example` is a template.

## Offline Mode (Ollama)
Offline mode uses Ollama to generate MCQs locally. See OFFLINE_MODE_SETUP.md.

## Project Structure
See PROJECT_STRUCTURE.md for a detailed map.
