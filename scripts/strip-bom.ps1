# Strips the UTF-8 byte-order mark from source and configuration files.
#
# Windows PowerShell 5.1 writes a BOM with `Set-Content -Encoding utf8`, but Node's JSON
# parser and several bundler internals reject one. This script normalises every text file in
# the repository to UTF-8 without a BOM and reports what it changed.
#
# Excluded: dependencies, build output, and anything Astro generates.

$root = Join-Path $PSScriptRoot '..'
$extensions = @('.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.astro', '.css', '.md', '.txt', '.yml', '.yaml', '.html', '.svg')
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$files = Get-ChildItem -Path $root -Recurse -File |
    Where-Object {
        $_.FullName -notmatch '\\(node_modules|dist|\.astro|\.git|coverage|test-results|playwright-report)\\' -and
        $extensions -contains $_.Extension.ToLower()
    }

$fixed = 0
foreach ($file in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    if ($bytes.Length -lt 3) { continue }
    if ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $text = $utf8NoBom.GetString($bytes, 3, $bytes.Length - 3)
        [System.IO.File]::WriteAllText($file.FullName, $text, $utf8NoBom)
        Write-Output ("stripped BOM: {0}" -f $file.FullName.Replace($root, ''))
        $fixed++
    }
}

Write-Output ("files fixed: {0}" -f $fixed)
