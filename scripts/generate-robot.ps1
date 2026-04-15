$API_KEY = "AIzaSyCMKu0zNfG46HYomHPqFwovAI2wde2mDdk"
$MODEL = "gemini-3-pro-image-preview"
$BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}"
$BASE = "C:\Users\Administrator\.openclaw\workspace\math-ai-kid\public\illustrations\character"

function Generate-Image($prompt, $outputPath) {
    $name = Split-Path $outputPath -Leaf
    if (Test-Path $outputPath) { Write-Host "SKIP: $name"; return $true }
    Write-Host "GEN:  $name"
    $bodyObj = @{
        contents = @(@{ parts = @(@{ text = $prompt }) })
        generationConfig = @{ responseModalities = @("IMAGE", "TEXT") }
    }
    $body = $bodyObj | ConvertTo-Json -Depth 10 -Compress
    try {
        $resp = Invoke-RestMethod -Uri $BASE_URL -Method POST -ContentType 'application/json' -Body $body -TimeoutSec 60
        $part = $resp.candidates[0].content.parts | Where-Object { $_.inlineData } | Select-Object -First 1
        if ($part) {
            $bytes = [Convert]::FromBase64String($part.inlineData.data)
            [IO.File]::WriteAllBytes($outputPath, $bytes)
            Write-Host "OK:   $name ($([math]::Round($bytes.Length/1024))KB)"
            return $true
        } else { Write-Host "FAIL: $name - no image"; return $false }
    } catch { Write-Host "ERR:  $name - $_"; return $false }
}

$assets = @(
    @{ file="$BASE\robot-happy.png";       prompt="A cute friendly robot character for children, flat vector art, white background, 512x512px. Happy smiling expression, round head with big glowing teal eyes, small antenna on top, stubby arms, teal (#1f6659) body with warm orange (#dd7d4a) accents. Child-friendly, rounded shapes, not scary, not industrial. No text." }
    @{ file="$BASE\robot-thinking.png";    prompt="A cute friendly robot character for children, flat vector art, white background, 512x512px. Thinking expression: head slightly tilted, gear or question mark floating above head, one arm raised to chin. Teal (#1f6659) body with orange (#dd7d4a) accents, same robot design as happy version. Child-friendly. No text." }
    @{ file="$BASE\robot-surprised.png";   prompt="A cute friendly robot character for children, flat vector art, white background, 512x512px. Surprised expression: wide eyes, both arms raised up, small exclamation marks around. Teal (#1f6659) body with orange (#dd7d4a) accents, same robot design. Child-friendly. No text." }
    @{ file="$BASE\robot-encouraging.png"; prompt="A cute friendly robot character for children, flat vector art, white background, 512x512px. Encouraging expression: giving thumbs up, warm glowing halo, happy crescent eyes. Teal (#1f6659) body with orange (#dd7d4a) accents, same robot design. Child-friendly. No text." }
    @{ file="$BASE\robot-playful.png";     prompt="A cute friendly robot character for children, flat vector art, white background, 512x512px. Playful mischievous expression: winking one eye, slight smirk, one arm stretched out playfully. Teal (#1f6659) body with orange (#dd7d4a) accents, same robot design. Child-friendly. No text." }
)

$ok = 0; $fail = 0
foreach ($a in $assets) {
    $r = Generate-Image $a.prompt $a.file
    if ($r) { $ok++ } else { $fail++ }
    Start-Sleep -Milliseconds 800
}
Write-Host "`n=== Done: $ok OK, $fail FAIL ==="
