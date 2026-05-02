# Offline Mode Setup (Ollama)

Offline mode uses Ollama to generate MCQs locally.

## 1) Install Ollama
- Download and install from https://ollama.com

## 2) Pull a Model
```powershell
ollama pull llama3.2
```

## 3) Start Ollama
```powershell
ollama serve
```

## 4) Switch Mode
```powershell
$body = @{ mode = "offline" } | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:5000/api/mode" `
  -Method Post -ContentType "application/json" -Body $body | ConvertFrom-Json
```
