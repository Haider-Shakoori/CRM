# Reverts `className=` back to `class=` on lowercase HTML elements in .astro files.
#
# Companion to fix-astro-component-classes.ps1. Astro renders HTML elements with the
# `class` attribute; `className` is only correct for framework components. Tags whose
# name begins with a lowercase letter are HTML elements.
#
# ASCII-only on purpose: it runs under Windows PowerShell 5.1.

$root = Join-Path $PSScriptRoot '..'
$files = Get-ChildItem -Path $root -Recurse -Filter *.astro -File |
    Where-Object { $_.FullName -notmatch '\\(node_modules|dist|\.astro)\\' }

$totalChanged = 0

foreach ($file in $files) {
    $text = Get-Content -Raw -LiteralPath $file.FullName
    $len = $text.Length
    $out = New-Object System.Text.StringBuilder
    $i = 0
    $changed = 0

    while ($i -lt $len) {
        if ($text[$i] -ne '<') {
            [void]$out.Append($text[$i])
            $i++
            continue
        }

        $j = $i + 1
        if ($j -lt $len -and $text[$j] -eq '/') { $j++ }
        $nameStart = $j
        while ($j -lt $len -and ($text[$j] -match '[A-Za-z0-9_$.]')) { $j++ }
        $tagName = $text.Substring($nameStart, $j - $nameStart)

        $isHtmlElement = $tagName.Length -gt 0 -and [char]::IsLower($tagName[0])

        $k = $j
        $quote = [char]0
        while ($k -lt $len) {
            $ch = $text[$k]
            if ($quote -ne [char]0) {
                if ($ch -eq $quote) { $quote = [char]0 }
            }
            elseif ($ch -eq '"' -or $ch -eq "'") { $quote = $ch }
            elseif ($ch -eq '>') { break }
            $k++
        }
        if ($k -ge $len) { $k = $len - 1 }

        $tagText = $text.Substring($i, $k - $i + 1)
        if ($isHtmlElement -and $tagText.Contains('className=')) {
            $tagText = $tagText.Replace('className=', 'class=')
            $changed++
        }
        [void]$out.Append($tagText)
        $i = $k + 1
    }

    if ($changed -gt 0) {
        Set-Content -LiteralPath $file.FullName -Value $out.ToString() -NoNewline -Encoding utf8
        Write-Output ("reverted {0} ({1} html tags)" -f $file.FullName.Replace($root, ''), $changed)
        $totalChanged++
    }
}

Write-Output ("files reverted: {0}" -f $totalChanged)
