# backfill-report-submitter.ps1
# One-time fill of "Submitted By" (cr1e9_submittedby) on Vacancy Reports that were created before
# the app started recording it. The name comes from Dataverse's own Created By on each report -
# the app writes as the signed-in user, so that is who submitted it.
#
# Only touches reports whose Submitted By is empty, so it's safe to re-run and never overwrites a
# name the app already recorded.
#
# Usage:
#   .\scripts\backfill-report-submitter.ps1 -OrgUrl "https://yourorg.crm.dynamics.com" -DryRun   # count only
#   .\scripts\backfill-report-submitter.ps1 -OrgUrl "https://yourorg.crm.dynamics.com"
#
# Requirements: Azure CLI logged in (az login) with write access to Vacancy Reports.

param(
    [Parameter(Mandatory)][string]$OrgUrl,
    [switch]$DryRun
)

$OrgUrl = $OrgUrl.TrimEnd('/')
Write-Host "Getting Azure AD token..." -ForegroundColor Cyan
$token = (az account get-access-token --resource "$OrgUrl" --query accessToken -o tsv 2>$null)
if (-not $token) { Write-Error "Could not get token. Run 'az login' first."; exit 1 }
$headers = @{
    Authorization = "Bearer $token"; "Content-Type" = "application/json"; "OData-MaxVersion" = "4.0"; "OData-Version" = "4.0"; Accept = "application/json"
    Prefer = 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
}
$base = "$OrgUrl/api/data/v9.2"

$uri = "$base/cr1e9_vacancyreportses?`$select=cr1e9_vacancyreportsid,_createdby_value&`$filter=cr1e9_submittedby eq null"
$updated = 0; $skipped = 0
while ($uri) {
    $page = Invoke-RestMethod -Uri $uri -Headers $headers
    foreach ($r in $page.value) {
        $name = $r.'_createdby_value@OData.Community.Display.V1.FormattedValue'
        if (-not $name) { $skipped++; continue }
        if (-not $DryRun) {
            $body = @{ cr1e9_submittedby = $name } | ConvertTo-Json
            Invoke-RestMethod -Method Patch -Uri "$base/cr1e9_vacancyreportses($($r.cr1e9_vacancyreportsid))" -Headers $headers -Body $body | Out-Null
        }
        $updated++
    }
    $uri = $page.'@odata.nextLink'
}

$verb = if ($DryRun) { "Would update" } else { "Updated" }
Write-Host "`nDone. $verb $updated report(s); skipped $skipped with no Created By name." -ForegroundColor Green
