# setup-appsettings-table.ps1
# Creates the cr1e9_appsettings table (a single global settings row, e.g. the
# quarterly portfolio vacancy goal) so admin-configurable values don't have to
# live as hardcoded constants in the app. Idempotent - safe to re-run.
#
# Usage:
#   .\scripts\setup-appsettings-table.ps1

param(
    [string]$OrgUrl = "https://orge3242d73.crm.dynamics.com"
)

$OrgUrl = $OrgUrl.TrimEnd('/')

Write-Host "Getting Azure AD token..." -ForegroundColor Cyan
$token = (az account get-access-token --resource "$OrgUrl" --query accessToken -o tsv 2>$null)
if (-not $token) { Write-Error "Could not get token. Run 'az login' first."; exit 1 }
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json"; "OData-MaxVersion" = "4.0"; "OData-Version" = "4.0"; Accept = "application/json" }
$base = "$OrgUrl/api/data/v9.2"

# Discover the publisher prefix rather than hardcoding it, so this script works against
# any tenant's default publisher, not just the one this app was originally built in.
Write-Host "Discovering publisher prefix..." -ForegroundColor Cyan
$pubs = Invoke-RestMethod -Uri "$base/publishers?`$filter=isreadonly eq false&`$select=customizationprefix" -Headers $headers
$prefix = ($pubs.value | Where-Object { $_.customizationprefix -and $_.customizationprefix -ne 'new' } | Select-Object -First 1).customizationprefix
if (-not $prefix) { $prefix = "new" }
Write-Host "  Using publisher prefix: $prefix" -ForegroundColor Green

function TableExists($logicalName) {
    try { Invoke-RestMethod -Uri "$base/EntityDefinitions(LogicalName='$logicalName')?`$select=LogicalName" -Headers $headers -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}
function ColumnExists($tableLogical, $colLogical) {
    try { Invoke-RestMethod -Uri "$base/EntityDefinitions(LogicalName='$tableLogical')/Attributes(LogicalName='$colLogical')?`$select=LogicalName" -Headers $headers -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}

$table = "${prefix}_appsettings"

if (-not (TableExists $table)) {
    Write-Host "Creating table '$table'..." -ForegroundColor White
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.EntityMetadata"
        SchemaName = $table
        DisplayName = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = "App Setting"; LanguageCode = 1033 }) }
        DisplayCollectionName = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = "App Settings"; LanguageCode = 1033 }) }
        OwnershipType = "UserOwned"
        IsActivity = $false; HasActivities = $false; HasNotes = $false
        PrimaryNameAttribute = "${prefix}_name"
        Attributes = @(
            @{
                "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
                SchemaName = "${prefix}_Name"
                IsPrimaryName = $true
                FormatName = @{ Value = "Text" }
                RequiredLevel = @{ "@odata.type" = "Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty"; Value = "ApplicationRequired"; CanBeChanged = $true; ManagedPropertyLogicalName = "canmodifyrequirementlevelsettings" }
                MaxLength = 100
                DisplayName = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = "Setting Name"; LanguageCode = 1033 }) }
            }
        )
    } | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions" -Headers $headers -Body $body | Out-Null
    Write-Host "  Created." -ForegroundColor Green
    Start-Sleep -Seconds 5
} else {
    Write-Host "Table '$table' already exists - skipping." -ForegroundColor Yellow
}

$goalCol = "${prefix}_portfoliovacancygoal"
if (-not (ColumnExists $table $goalCol)) {
    Write-Host "Adding column '$goalCol'..." -ForegroundColor White
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.IntegerAttributeMetadata"
        SchemaName = "${prefix}_portfoliovacancygoal"
        MinValue = 0; MaxValue = 999999; Format = "None"
        RequiredLevel = @{ "@odata.type" = "Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty"; Value = "None"; CanBeChanged = $true; ManagedPropertyLogicalName = "canmodifyrequirementlevelsettings" }
        DisplayName = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = "Portfolio Vacancy Goal"; LanguageCode = 1033 }) }
    } | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions(LogicalName='$table')/Attributes" -Headers $headers -Body $body | Out-Null
    Write-Host "  Added." -ForegroundColor Green
} else {
    Write-Host "Column '$goalCol' already exists - skipping." -ForegroundColor Yellow
}

# Resolve the real (auto-pluralized) entity set name rather than guessing it
$meta = Invoke-RestMethod -Uri "$base/EntityDefinitions(LogicalName='$table')?`$select=EntitySetName" -Headers $headers
$entitySet = $meta.EntitySetName
Write-Host "Entity set name: $entitySet" -ForegroundColor Cyan

# Seed the single "Global" settings row if it doesn't exist yet
$existing = Invoke-RestMethod -Uri "$base/${entitySet}?`$filter=${prefix}_name eq 'Global'&`$select=${prefix}_appsettingsid" -Headers $headers
if ($existing.value.Count -eq 0) {
    Write-Host "Seeding 'Global' settings row (portfolio goal = 130)..." -ForegroundColor White
    $seedBody = @{ "${prefix}_name" = "Global"; "${prefix}_portfoliovacancygoal" = 130 } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$base/${entitySet}" -Headers $headers -Body $seedBody | Out-Null
    Write-Host "  Seeded." -ForegroundColor Green
} else {
    Write-Host "'Global' settings row already exists - skipping." -ForegroundColor Yellow
}

Write-Host "`nDone." -ForegroundColor Green
