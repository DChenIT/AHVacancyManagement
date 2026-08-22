# import-communities-csv.ps1
# Upserts Communities from a SharePoint list CSV export into Dataverse (cr1e9_communities).
# Repeatable: matches existing rows by Community Code, so re-running with a fresh export
# updates changed contacts and adds newly-acquired properties without duplicating rows.
#
# Usage:
#   .\scripts\import-communities-csv.ps1 -CsvPath "C:\path\to\export.csv"
#
# Expects the SharePoint "export to CSV" format, where line 1 is a ListSchema metadata
# blob (skipped) and line 2 is the real column header row.
#
# Column mapping (source CSV -> Dataverse):
#   Title                        -> cr1e9_name
#   Community Code                -> cr1e9_communitycode
#   Administrator                 -> cr1e9_propertymanager   (site administrator)
#   Regional Property Supervisor  -> cr1e9_regionalmanager
#   Director                      -> cr1e9_director
#   Asset Manager                 -> cr1e9_assetmanager
#   %23 of units ("# of units")   -> cr1e9_numberofunits
#
# App-owned fields (cr1e9_hoppergoal, cr1e9_active, cr1e9_defaultreportrecipients) are
# never touched on update, so this script won't clobber values set inside the app.

param(
    [Parameter(Mandatory)][string]$CsvPath,
    [string]$OrgUrl = "https://orge3242d73.crm.dynamics.com"
)

$OrgUrl = $OrgUrl.TrimEnd('/')
if (-not (Test-Path $CsvPath)) { Write-Error "CSV not found: $CsvPath"; exit 1 }

Write-Host "Getting Azure AD token..." -ForegroundColor Cyan
$token = (az account get-access-token --resource "$OrgUrl" --query accessToken -o tsv 2>$null)
if (-not $token) { Write-Error "Could not get token. Run 'az login' first."; exit 1 }
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json"; "OData-MaxVersion" = "4.0"; "OData-Version" = "4.0"; Accept = "application/json" }
$base = "$OrgUrl/api/data/v9.2"

# Line 1 of a SharePoint CSV export is a ListSchema metadata blob, not data - skip it.
$lines = Get-Content -Path $CsvPath -Encoding UTF8
$csvContent = ($lines[1..($lines.Count - 1)] -join "`n")
$rows = $csvContent | ConvertFrom-Csv
Write-Host "Found $($rows.Count) rows in CSV." -ForegroundColor Cyan

$existing = Invoke-RestMethod -Uri "$base/cr1e9_communitieses?`$select=cr1e9_communitiesid,cr1e9_communitycode" -Headers $headers
$existingByCode = @{}
foreach ($e in $existing.value) {
    if ($e.cr1e9_communitycode) { $existingByCode[$e.cr1e9_communitycode.Trim()] = $e.cr1e9_communitiesid }
}

$created = 0; $updated = 0; $skipped = 0
foreach ($row in $rows) {
    $name = ($row.Title ?? '').Trim()
    $code = ($row.'Community Code' ?? '').Trim()
    if (-not $name -or -not $code) { $skipped++; continue }

    $units = 0
    [void][int]::TryParse(($row.'%23 of units' ?? ''), [ref]$units)

    $body = @{
        cr1e9_name = $name
        cr1e9_communitycode = $code
        cr1e9_propertymanager = $row.Administrator
        cr1e9_regionalmanager = $row.'Regional Property Supervisor'
        cr1e9_director = $row.Director
        cr1e9_assetmanager = $row.'Asset Manager'
        cr1e9_numberofunits = $units
    } | ConvertTo-Json

    if ($existingByCode.ContainsKey($code)) {
        Invoke-RestMethod -Method Patch -Uri "$base/cr1e9_communitieses($($existingByCode[$code]))" -Headers $headers -Body $body | Out-Null
        $updated++
    } else {
        Invoke-RestMethod -Method Post -Uri "$base/cr1e9_communitieses" -Headers $headers -Body $body | Out-Null
        $created++
    }
}

Write-Host "`nDone. Created: $created, Updated: $updated, Skipped (missing name/code): $skipped" -ForegroundColor Green
