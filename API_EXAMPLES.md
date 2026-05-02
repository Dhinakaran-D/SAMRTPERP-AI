# API Examples

Base URL: `http://localhost:5000/api`

## Health
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/health" | ConvertFrom-Json
```

## Get Mode
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/mode" | ConvertFrom-Json
```

## Set Mode
```powershell
$body = @{ mode = "offline" } | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:5000/api/mode" `
  -Method Post -ContentType "application/json" -Body $body | ConvertFrom-Json
```

## Upload PDF
```powershell
$file = Get-Item "C:\Path\To\sample.pdf"
$form = @{ pdf_file = $file; category = "Banking" }
Invoke-WebRequest -Uri "http://localhost:5000/api/upload-pdf" `
  -Method Post -Form $form | ConvertFrom-Json
```

## Generate MCQs
```powershell
$body = @{ topic = "Banking"; num_questions = 5; difficulty = "medium" } | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:5000/api/generate-mcqs" `
  -Method Post -ContentType "application/json" -Body $body | ConvertFrom-Json
```

## List Documents
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/documents" | ConvertFrom-Json
```

## Clear Database
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/clear-database" -Method Post | ConvertFrom-Json
```
