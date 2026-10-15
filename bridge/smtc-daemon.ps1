[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

[System.Reflection.Assembly]::LoadWithPartialName('System.Runtime.WindowsRuntime') | Out-Null
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and
    $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function AwaitOperation($winRtOp, $resultType) {
    if ($null -eq $winRtOp) { return $null }
    try {
        $netTask = $asTaskGeneric.MakeGenericMethod($resultType).Invoke($null, @($winRtOp))
        if ($netTask.Wait(1200)) {
            return $netTask.Result
        }
        return $null
    } catch {
        return $null
    }
}

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null

$mgr = $null
try {
    $op = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
    $mgr = AwaitOperation $op ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
} catch {}

if (-not $mgr) {
    Write-Output '{"event":"error","message":"Failed to initialize GSMTC Session Manager"}'
    exit 0
}

Write-Output '{"event":"ready"}'

# Non-blocking STDIN reader thread
$cmdQueue = New-Object 'System.Collections.Concurrent.ConcurrentQueue[string]'
$stdinThread = [System.Threading.Thread]::new([System.Threading.ThreadStart]{
    try {
        while ($true) {
            $line = [Console]::In.ReadLine()
            if ($null -ne $line) {
                $cmdQueue.Enqueue($line)
            } else {
                [System.Threading.Thread]::Sleep(120)
            }
        }
    } catch {}
})
$stdinThread.IsBackground = $true
$stdinThread.Start()

function GetActiveSession {
    try {
        $sessions = $mgr.GetSessions()
        
        # Priority 1: Check for active playing session first
        foreach ($s in $sessions) {
            try {
                $pb = $s.GetPlaybackInfo()
                if ($pb -and $pb.PlaybackStatus.ToString() -eq "Playing") {
                    return $s
                }
            } catch {}
        }
        
        # Priority 2: Spotify session (even if paused)
        foreach ($s in $sessions) {
            try {
                if ($s.SourceAppId -and $s.SourceAppId.ToLower().Contains("spotify")) {
                    return $s
                }
            } catch {}
        }

        # Priority 3: Fallback to current manager session
        try {
            $cur = $mgr.GetCurrentSession()
            if ($cur) { return $cur }
        } catch {}

        if ($sessions.Count -gt 0) {
            return $sessions[0]
        }
    } catch {}
    return $null
}

function GetCurrentMediaState {
    $session = GetActiveSession
    if (-not $session) {
        return @{ active = $false }
    }

    try {
        $propOp = $session.TryGetMediaPropertiesAsync()
        $props = AwaitOperation $propOp ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        $timeline = $session.GetTimelineProperties()
        $playback = $session.GetPlaybackInfo()

        if (-not $props -or [string]::IsNullOrWhiteSpace($props.Title)) {
            return @{ active = $false }
        }

        $statusStr = $playback.PlaybackStatus.ToString()
        $rawPos = $timeline.Position.TotalSeconds
        $duration = $timeline.EndTime.TotalSeconds

        # Real-time position compensation:
        # Spotify only updates .Position on track change / seek / pause.
        # When Playing, we add the elapsed time since LastUpdatedTime.
        $actualPos = $rawPos
        if ($timeline.LastUpdatedTime -and $statusStr -eq "Playing") {
            $diff = ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime).TotalSeconds
            if ($diff -gt 0 -and $diff -lt 86400) {
                $actualPos = $rawPos + $diff
            }
        }

        if ($duration -gt 0 -and $actualPos -gt $duration) {
            $actualPos = $duration
        }

        return @{
            active = $true
            appId = $session.SourceAppId
            title = $props.Title
            artist = $props.Artist
            album = $props.AlbumTitle
            status = $statusStr
            position = [Math]::Round($actualPos, 2)
            rawPosition = [Math]::Round($rawPos, 2)
            duration = [Math]::Round($duration, 2)
            lastUpdated = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        }
    } catch {
        return @{ active = $false; error = $_.Exception.Message }
    }
}

$lastStateJson = ""
$lastCheckTime = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

while ($true) {
    try {
        # Process incoming commands
        $cmdLine = $null
        $forceEmit = $false
        while ($cmdQueue.TryDequeue([ref]$cmdLine)) {
            if (-not [string]::IsNullOrWhiteSpace($cmdLine)) {
                try {
                    $cmd = $cmdLine | ConvertFrom-Json
                    $activeSess = GetActiveSession
                    if ($activeSess) {
                        if ($cmd.action -eq "playpause") {
                            $activeSess.TryTogglePlayPauseAsync() | Out-Null
                        } elseif ($cmd.action -eq "next") {
                            $activeSess.TrySkipNextAsync() | Out-Null
                        } elseif ($cmd.action -eq "previous") {
                            $activeSess.TrySkipPreviousAsync() | Out-Null
                        } elseif ($cmd.action -eq "seek" -and $null -ne $cmd.position) {
                            $ticks = [long]($cmd.position * 10000000)
                            $activeSess.TryChangePlaybackPositionAsync($ticks) | Out-Null
                        }
                    }
                    if ($cmd.action -eq "resync") {
                        $forceEmit = $true
                    }
                } catch {}
            }
        }

        $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        if ($forceEmit -or ($now - $lastCheckTime) -ge 950) {
            $state = GetCurrentMediaState
            $stateObj = @{
                event = "mediaUpdate"
                data = $state
            }
            $stateJson = $stateObj | ConvertTo-Json -Compress
            Write-Output $stateJson
            $lastStateJson = $stateJson
            $lastCheckTime = $now
        }
    } catch {}

    Start-Sleep -Milliseconds 200
}
