# ===================================================
# Auto-Embedding Scheduler Setup (Windows)
# ===================================================

$taskName = "AudicoAutoEmbedding"
$workingDir = "D:\AudicoAI\audico_quotes_modern\audico-mcp-servers"
$nodeCmd = "npm"
$nodeArgs = "run embed:auto"

Write-Host "Setting up Auto-Embedding Scheduler" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "WARNING: Task '$taskName' already exists!" -ForegroundColor Yellow
    $response = Read-Host "Do you want to remove and recreate it? (y/n)"

    if ($response -eq "y") {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "Removed existing task" -ForegroundColor Green
    } else {
        Write-Host "Cancelled. Existing task not modified." -ForegroundColor Red
        exit
    }
}

# Create action
$action = New-ScheduledTaskAction `
    -Execute $nodeCmd `
    -Argument $nodeArgs `
    -WorkingDirectory $workingDir

# Create trigger (every 15 minutes)
$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 15)

# Create settings
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

# Register the task
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Automatically generates embeddings for new products in Audico system" `
    -RunLevel Highest

Write-Host ""
Write-Host "SUCCESS! Task scheduled successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Task Details:" -ForegroundColor Cyan
Write-Host "  Name: $taskName"
Write-Host "  Runs: Every 15 minutes"
Write-Host "  Command: $nodeCmd $nodeArgs"
Write-Host "  Working Directory: $workingDir"
Write-Host ""
Write-Host "Management Commands:" -ForegroundColor Yellow
Write-Host "  View task:    Get-ScheduledTask -TaskName '$taskName'"
Write-Host "  Run now:      Start-ScheduledTask -TaskName '$taskName'"
Write-Host "  Stop:         Stop-ScheduledTask -TaskName '$taskName'"
Write-Host "  Remove:       Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
Write-Host ""
Write-Host "Auto-embedding will now run automatically every 15 minutes!" -ForegroundColor Green
Write-Host ""
