# Rewrites `class=` to `className=` inside JSX component tags in .astro files.
#
# Astro distinguishes HTML elements (lowercase tag, `class` attribute) from framework
# components imported into the frontmatter (uppercase tag, framework prop names). Lucide
# React icons accept `className`, not `class`, so any icon used directly in an .astro
# template needs the React prop name.
#
# Implementation note: a single regex over a whole template is prone to catastrophic
# backtracking, so this script uses a small character scanner instead. It is O(n), has no
# nested quantifiers, and is idempotent.
#
# This file is deliberately ASCII-only: it runs under Windows PowerShell 5.1, which
# mis-decodes UTF-8 without a BOM.

$root = Join-Path $PSScriptRoot '..'
$files = Get-ChildItem -Path $root -Recurse -Filter *.astro -File |
    Where-Object { $_.FullName -notmatch '\\(node_modules|dist|\.astro)\\' }

$totalChanged = 0

foreach ($file in $files) {
    $text = Get-Content -Raw -LiteralPath $file.FullName
    $len = $text.Length

    # Component names come from the file's own imports, so we only touch real components.
    $frontmatter = ''
    $fm = [regex]::Match($text, '(?s)^---\r?\n(.*?)\r?\n---')
    if ($fm.Success) { $frontmatter = $fm.Groups[1].Value }

    $names = New-Object System.Collections.Generic.HashSet[string]
    foreach ($m in [regex]::Matches($frontmatter, 'import\s+(?:type\s+)?\{([^}]*)\}\s+from')) {
        foreach ($part in $m.Groups[1].Value -split ',') {
            $n = ($part -split '\s+as\s+')[-1].Trim()
            if ($n) { [void]$names.Add($n) }
        }
    }
    foreach ($m in [regex]::Matches($frontmatter, 'import\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s+from')) {
        [void]$names.Add($m.Groups[1].Value)
    }
    if ($names.Count -eq 0) { continue }

    $out = New-Object System.Text.StringBuilder
    $i = 0
    $changed = 0

    while ($i -lt $len) {
        if ($text[$i] -ne '<') {
            [void]$out.Append($text[$i])
            $i++
            continue
        }

        # Read the tag name.
        $j = $i + 1
        if ($j -lt $len -and $text[$j] -eq '/') { $j++ }
        $nameStart = $j
        while ($j -lt $len -and ($text[$j] -match '[A-Za-z0-9_$.]')) { $j++ }
        $tagName = $text.Substring($nameStart, $j - $nameStart)

        if (-not $names.Contains($tagName)) {
            [void]$out.Append($text[$i])
            $i++
            continue
        }

        # Find the end of the opening tag, respecting quoted attribute values.
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
        $newTagText = [regex]::Replace($tagText, '(?<![\w-])class=', 'className=')
        if ($newTagText -ne $tagText) { $changed++ }

        [void]$out.Append($newTagText)
        $i = $k + 1
    }

    if ($changed -gt 0) {
        Set-Content -LiteralPath $file.FullName -Value $out.ToString() -NoNewline -Encoding utf8
        Write-Output ("updated {0} ({1} component tags)" -f $file.FullName.Replace($root, ''), $changed)
        $totalChanged++
    }
}

Write-Output ("files updated: {0}" -f $totalChanged)
