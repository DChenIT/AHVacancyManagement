# import-communities-from-export.ps1
# Upserts Communities from a Dataverse-native CSV export (raw cr1e9_* column headers,
# one clean header row - not the SharePoint list export format import-communities-csv.ps1
# expects) into the target org's cr1e9_communities table.
#
# Use this after a fresh solution import leaves Communities empty (solution import moves
# schema only, never row data) - point it at a CSV exported directly from another
# Dataverse environment's Communities table.
#
# Repeatable: matches existing rows by Community Code, so re-running updates changed
# contacts and adds newly-acquired properties without duplicating rows.
#
# Usage:
#   .\scripts\import-communities-from-export.ps1 -CsvPath "C:\path\to\communities_export.csv" -OrgUrl "https://yourorg.crm.dynamics.com"

param(
    [Parameter(Mandatory)][string]$CsvPath,
    [Parameter(Mandatory)][string]$OrgUrl
)

$OrgUrl = $OrgUrl.TrimEnd('/')
if (-not (Test-Path $CsvPath)) { Write-Error "CSV not found: $CsvPath"; exit 1 }

Write-Host "Getting Azure AD token..." -ForegroundColor Cyan
$token = (az account get-access-token --resource "$OrgUrl" --query accessToken -o tsv 2>$null)
if (-not $token) { Write-Error "Could not get token. Run 'az login' first."; exit 1 }
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json"; "OData-MaxVersion" = "4.0"; "OData-Version" = "4.0"; Accept = "application/json" }
$base = "$OrgUrl/api/data/v9.2"

$rows = Import-Csv -Path $CsvPath
Write-Host "Found $($rows.Count) rows in CSV." -ForegroundColor Cyan

$existing = Invoke-RestMethod -Uri "$base/cr1e9_communitieses?`$select=cr1e9_communitiesid,cr1e9_communitycode" -Headers $headers
$existingByCode = @{}
foreach ($r in $existing.value) { $existingByCode[$r.cr1e9_communitycode] = $r.cr1e9_communitiesid }

# App-owned fields (cr1e9_hoppergoal, cr1e9_active, cr1e9_defaultreportrecipients) are only
# written here because this is a first-time population into an empty table - on a later
# re-run against a table with real app usage, remove these three lines to avoid clobbering.
$created = 0; $updated = 0
foreach ($row in $rows) {
    $code = $row.cr1e9_communitycode
    if (-not $code) { continue }
    $body = @{
        cr1e9_name                         = $row.cr1e9_name
        cr1e9_director                     = $row.cr1e9_director
        cr1e9_regionalmanager              = $row.cr1e9_regionalmanager
        cr1e9_regionalmaintenancesupervisor = $row.cr1e9_regionalmaintenancesupervisor
        cr1e9_compliancespecialist         = $row.cr1e9_compliancespecialist
        cr1e9_propertymanager              = $row.cr1e9_propertymanager
        cr1e9_assetmanager                 = $row.cr1e9_assetmanager
        cr1e9_defaultreportrecipients      = $row.cr1e9_defaultreportrecipients
        cr1e9_communitycode                = $code
    }
    if ($row.cr1e9_numberofunits) { $body.cr1e9_numberofunits = [int]$row.cr1e9_numberofunits }
    if ($row.cr1e9_hoppergoal) { $body.cr1e9_hoppergoal = [int]$row.cr1e9_hoppergoal }
    if ($row.cr1e9_active) { $body.cr1e9_active = [System.Convert]::ToBoolean($row.cr1e9_active) }

    $json = $body | ConvertTo-Json

    if ($existingByCode.ContainsKey($code)) {
        Invoke-RestMethod -Method Patch -Uri "$base/cr1e9_communitieses($($existingByCode[$code]))" -Headers $headers -Body $json | Out-Null
        $updated++
    } else {
        Invoke-RestMethod -Method Post -Uri "$base/cr1e9_communitieses" -Headers $headers -Body $json | Out-Null
        $created++
    }
}
Write-Host "Done. Created $created, updated $updated." -ForegroundColor Green
