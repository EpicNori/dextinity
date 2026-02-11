param (
    [Parameter(Mandatory = $true)]
    [string]$Goal
)

# Antigravity Ralph Wiggum Loop
# Based on antigravity-ralfwiggum-loop.skill

$LogFile = "ralph_loop_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
Write-Host "� Logging output to: $LogFile" -ForegroundColor Gray

while ($true) {
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $Header = "`n[$Timestamp] 🚀 Starting Iteration... Goal: $Goal`n" + "-" * 50
    
    Write-Host $Header -ForegroundColor Cyan
    Add-Content -Path $LogFile -Value $Header

    # Execute Antigravity Agent via local CLI
    # Redirect stderr to stdout (2>&1) and pipe to Tee-Object to save to file + show on screen
    node cli.js task "$Goal" 2>&1 | Tee-Object -FilePath $LogFile -Append
    
    if ($LASTEXITCODE -eq 0) {
        $SuccessMsg = "`n✅ Task successfully completed!"
        Write-Host $SuccessMsg -ForegroundColor Green
        Add-Content -Path $LogFile -Value $SuccessMsg
        break
    }
    else {
        $RetryMsg = "`n🔄 Iteration finished, restarting for refinement..."
        Write-Host $RetryMsg -ForegroundColor Yellow
        Add-Content -Path $LogFile -Value $RetryMsg
        Start-Sleep -Seconds 2
    }
}
