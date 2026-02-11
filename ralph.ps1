param (
    [Parameter(Mandatory=$true)]
    [string]$Goal
)

# Antigravity Ralph Wiggum Loop
# Based on antigravity-ralfwiggum-loop.skill

while ($true) {
    Write-Host "🚀 Starting Iteration... Goal: $Goal" -ForegroundColor Cyan
    
    # Execute Antigravity Agent
    # We use 'cmd /c' to ensure we can catch the exit code properly if it's a batch file or similar wrapper
    # Assuming 'ag' is available in the PATH.
    # If this is specifically for this project context where 'ag' might not be installed globally,
    # user might need to adjust the command.
    
    & ag task "$Goal" --non-interactive --verify
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Task successfully completed!" -ForegroundColor Green
        break
    } else {
        Write-Host "🔄 Iteration finished, restarting for refinement..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}
