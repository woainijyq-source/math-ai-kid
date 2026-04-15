# T5.6-T5.8 批量生成脚本（PowerShell）
# 运行：.\scripts\generate-assets.ps1

$API_KEY = "AIzaSyCMKu0zNfG46HYomHPqFwovAI2wde2mDdk"
$MODEL = "gemini-3-pro-image-preview"
$BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}"
$BASE = "C:\Users\Administrator\.openclaw\workspace\math-ai-kid\public\illustrations"

function Generate-Image($prompt, $outputPath) {
    $name = Split-Path $outputPath -Leaf
    if (Test-Path $outputPath) {
        Write-Host "  SKIP: $name (already exists)"
        return $true
    }
    Write-Host "  GEN:  $name"
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
            $dir = Split-Path $outputPath -Parent
            if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
            [IO.File]::WriteAllBytes($outputPath, $bytes)
            Write-Host "  OK:   $name ($([math]::Round($bytes.Length/1024))KB)"
            return $true
        } else {
            Write-Host "  FAIL: $name - no image in response"
            return $false
        }
    } catch {
        Write-Host "  ERR:  $name - $_"
        return $false
    }
}

$assets = @(
    # T5.6 — 角色（已生成 happy，跳过）
    @{ file="$BASE\character\brainy-happy.png";        prompt="A cute cartoon fox named Brain-Brain, flat vector art, transparent/white background, 512x512px. Happy smiling expression, orange fur with white belly, big sparkling eyes, small star badge. Child-friendly, warm colors, clean lines, no text." }
    @{ file="$BASE\character\brainy-thinking.png";     prompt="A cute cartoon fox named Brain-Brain, flat vector art, white background, 512x512px. Thinking pose: one paw on chin, eyes looking upward, thought bubble with question mark. Orange fur with white belly. Child-friendly, no text." }
    @{ file="$BASE\character\brainy-surprised.png";    prompt="A cute cartoon fox named Brain-Brain, flat vector art, white background, 512x512px. Surprised expression: wide eyes, open mouth, ears perked, small exclamation marks. Orange fur with white belly. Child-friendly, no text." }
    @{ file="$BASE\character\brainy-encouraging.png";  prompt="A cute cartoon fox named Brain-Brain, flat vector art, white background, 512x512px. Encouraging pose: thumbs up, happy crescent eyes, golden stars around. Orange fur with white belly. Child-friendly, no text." }
    @{ file="$BASE\character\brainy-playful.png";      prompt="A cute cartoon fox named Brain-Brain, flat vector art, white background, 512x512px. Playful mischievous expression: winking one eye, smirk, curled tail, sparkle effects. Orange fur with white belly. Child-friendly, no text." }
    # T5.7 — 背景
    @{ file="$BASE\backgrounds\math.png";              prompt="Soft dreamy background for children's math app, 1920x1080px landscape. Floating numbers, geometric shapes, gentle orange and yellow gradient, subtle grid. No characters, no text. Flat design, child-friendly." }
    @{ file="$BASE\backgrounds\logic.png";             prompt="Soft dreamy background for children's logic app, 1920x1080px landscape. Connected dots forming constellations, flowing arrows, puzzle silhouettes, soft blue purple tones. No characters, no text. Flat design." }
    @{ file="$BASE\backgrounds\creative.png";          prompt="Soft dreamy background for children's creative thinking app, 1920x1080px landscape. Colorful paint splashes, pencil doodles, lightbulbs, stars, rainbow gradients. No characters, no text. Flat design." }
    @{ file="$BASE\backgrounds\language.png";          prompt="Soft dreamy background for children's language app, 1920x1080px landscape. Speech bubbles, floating letters, bookmarks, soft green teal tones. No characters, no text. Flat design." }
    @{ file="$BASE\backgrounds\general.png";           prompt="Soft dreamy background for children's thinking game app, 1920x1080px landscape. Gentle clouds, small stars, soft gradient from warm peach to light lavender. No characters, no text. Flat design." }
    # T5.8 — 图标
    @{ file="$BASE\icons\math-thinking.png";           prompt="Single flat icon, 128x128px, white background. Glowing brain with numbers floating around, orange yellow tones. Clean vector, child-friendly, no text." }
    @{ file="$BASE\icons\logical-reasoning.png";       prompt="Single flat icon, 128x128px, white background. Interlocking gears with magnifying glass, blue tones. Clean vector, child-friendly, no text." }
    @{ file="$BASE\icons\creative-thinking.png";       prompt="Single flat icon, 128x128px, white background. Colorful lightbulb with star sparkles, purple yellow tones. Clean vector, child-friendly, no text." }
    @{ file="$BASE\icons\language-thinking.png";       prompt="Single flat icon, 128x128px, white background. Speech bubble with small letters inside, green tones. Clean vector, child-friendly, no text." }
    @{ file="$BASE\icons\strategy-thinking.png";       prompt="Single flat icon, 128x128px, white background. Chess knight piece with shield, deep blue tones. Clean vector, child-friendly, no text." }
    @{ file="$BASE\icons\observation-induction.png";   prompt="Single flat icon, 128x128px, white background. Eye with stars and dots forming pattern, teal tones. Clean vector, child-friendly, no text." }
    @{ file="$BASE\icons\voice-input.png";             prompt="Single flat icon, 128x128px, white background. Microphone with sound waves, warm orange tones. Clean vector, child-friendly, no text." }
    @{ file="$BASE\icons\photo-input.png";             prompt="Single flat icon, 128x128px, white background. Camera with small star, soft blue tones. Clean vector, child-friendly, no text." }
    @{ file="$BASE\icons\drawing-input.png";           prompt="Single flat icon, 128x128px, white background. Pencil drawing colorful line, warm tones. Clean vector, child-friendly, no text." }
    @{ file="$BASE\icons\badge-star.png";              prompt="Single flat icon, 128x128px, white background. Golden star badge with sparkles, gold yellow tones. Clean vector, child-friendly, no text." }
    @{ file="$BASE\icons\badge-brain.png";             prompt="Single flat icon, 128x128px, white background. Purple brain trophy cup, purple silver tones. Clean vector, child-friendly, no text." }
    @{ file="$BASE\icons\badge-creative.png";          prompt="Single flat icon, 128x128px, white background. Rainbow paintbrush making colorful arc, vibrant tones. Clean vector, child-friendly, no text." }
)

$success = 0; $fail = 0
Write-Host "`n=== 开始生成 $($assets.Count) 个素材 ==="
foreach ($a in $assets) {
    $ok = Generate-Image $a.prompt $a.file
    if ($ok) { $success++ } else { $fail++ }
    Start-Sleep -Milliseconds 800
}
Write-Host "`n=== 完成: $success 成功, $fail 失败 ==="
