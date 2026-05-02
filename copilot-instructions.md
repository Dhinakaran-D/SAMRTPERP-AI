# GitHub Copilot Instructions for SmartPrep AI RAG Project

## Project Overview
This is SmartPrep AI, a complete Python full-stack RAG (Retrieval Augmented Generation) application for competitive exam preparation. It features a Flask backend with a modern web interface for PDF upload, question answering, and MCQ generation.

## Key Technologies
- **Backend**: Python, Flask, LangChain, FAISS, PyPDF2
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **RAG**: Sentence Transformers embeddings, Ollama LLM, Vector database
- **Development**: VS Code, Virtual environment, Windows-focused

## Project Structure
```
SmartPrep-AI/
├── backend/          # Flask API and RAG pipeline
├── frontend/         # Web UI (HTML, CSS, JS)
├── uploads/          # User-uploaded PDFs
├── .vscode/          # VS Code settings and tasks
└── Documentation files (README, QUICKSTART, API_EXAMPLES, PROJECT_STRUCTURE)
```

## Setup Status
- Backend API: app.py, rag_pipeline.py, mcq_generator.py
- Frontend: index.html with gradient UI, style.css, script.js
- Configuration: requirements.txt, setup.bat, .env.example
- Documentation: Complete with examples and troubleshooting

## For Code Generation & Modifications
When working on this project:

1. **Python Code**: Follow PEP 8 style, use type hints, add logging
2. **JavaScript**: Use ES6+, handle errors gracefully, test in console
3. **CSS**: Use gradient variables, maintain responsive design
4. **Error Handling**: Return JSON errors from API, toast notifications in UI
5. **Documentation**: Update README and API_EXAMPLES.md for changes

## Important Considerations
- Keep dependencies minimal and beginner-friendly
- Avoid breaking existing API contracts
- Test changes with sample PDFs
- Maintain CORS configuration for frontend-backend communication
- Support Windows PowerShell environment

## Current Capabilities
- ✅ PDF upload with category support
- ✅ RAG-powered Q&A system
- ✅ MCQ generation with explanations
- ✅ Document management
- ✅ Colorful responsive web UI
- ✅ Complete API documentation

## Common Tasks

**To add new feature**:
1. Add API endpoint in app.py
2. Implement business logic in appropriate module
3. Add frontend UI in index.html
4. Add JavaScript handler in script.js
5. Update API_EXAMPLES.md

**To modify styling**:
1. Edit CSS variables in style.css
2. Test responsiveness
3. Ensure gradient theme consistency

**To improve RAG performance**:
1. Adjust chunk size in rag_pipeline.py
2. Modify top_k in retriever settings
3. Try different embedding models
4. Tune prompt templates

## Testing
- Manual testing via frontend UI
- API testing via PowerShell/cURL examples in API_EXAMPLES.md
- Check browser console (F12) for frontend errors
- Check terminal output for backend errors

## Before Committing
- Run setup.bat to verify dependencies
- Test all API endpoints
- Verify frontend loads and connects to backend
- Check for Python syntax errors
- Keep .env and uploads/ files out of git (via .gitignore)

## Questions or Issues?
- Refer to README.md for troubleshooting
- Check QUICKSTART.md for setup issues
- Review API_EXAMPLES.md for integration help
- Look at PROJECT_STRUCTURE.md for file explanations
