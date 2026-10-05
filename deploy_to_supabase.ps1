# BioChain Vote - Supabase Deployment Script
Param(
    [Parameter(Mandatory=$true)]
    [string]$ServiceRoleKey
)

$projectId = "hbuxgqnbbheyuwxmquvp"
$bucket = "biochain%20voting"
$baseUrl = "https://$projectId.supabase.co/storage/v1/object/$bucket"
$distPath = "$PSScriptRoot/dist"

if (-not (Test-Path $distPath)) {
    Write-Error "Error: 'dist' folder not found. Run 'npm run build' first."
    exit
}

Write-Host "🚀 Starting Advanced Supabase Deployment..." -ForegroundColor Cyan

Get-ChildItem -Path $distPath -Recurse -File | ForEach-Object {
    $fileRelativePath = $_.FullName.Substring($distPath.Length + 1).Replace("\", "/")
    $uploadUrl = "$baseUrl/$fileRelativePath"
    
    $contentType = switch ($_.Extension.ToLower()) {
        ".html" { "text/html" }
        ".css"  { "text/css" }
        ".js"   { "application/javascript" }
        ".svg"  { "image/svg+xml" }
        ".png"  { "image/png" }
        ".jpg"  { "image/jpeg" }
        ".ico"  { "image/x-icon" }
        default { "application/octet-stream" }
    }

    Write-Host "📤 Uploading: $fileRelativePath ($contentType)... " -NoNewline
    
    try {
        $headers = @{
            "Authorization" = "Bearer $ServiceRoleKey"
            "apikey"        = "$ServiceRoleKey"
            "x-upsert"      = "true"
            "Content-Type"  = $contentType
        }
        
        $response = Invoke-RestMethod -Uri $uploadUrl -Method Post -Headers $headers -InFile $_.FullName
        Write-Host "DONE" -ForegroundColor Green
    } catch {
        Write-Host "FAILED" -ForegroundColor Red
        Write-Warning $_.Exception.Message
    }
}

Write-Host "`n✅ Deployment Complete!" -ForegroundColor Green
Write-Host "Visit: https://$projectId.supabase.co/storage/v1/object/public/biochain%20voting/index.html" -ForegroundColor Yellow
