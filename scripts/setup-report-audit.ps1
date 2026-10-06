# setup-report-audit.ps1
# Adds the report audit trail:
#   - cr1e9_reportaudit table (one row per Created / Edited / Review event on a report: who, what, when -
#     the "when" is the row's own Created On)
#   - "Last Edited By" / "Last Edited On" columns on cr1e9_vacancyreports
# Idempotent - safe to re-run. setup-dataverse.ps1 only creates the original tables, so run this after it
# when building a fresh environment (not needed when you import the solution, which carries all of this).
#
# Usage:
#   .\scripts\setup-report-audit.ps1
#   .\scripts\setup-report-audit.ps1 -OrgUrl "https://yourorg.crm.dynamics.com"

param(
    [string]$OrgUrl = "https://orge3242d73.crm.dynamics.com"
)

$OrgUrl = $OrgUrl.TrimEnd('/')

Write-Host "Getting Azure AD token..." -ForegroundColor Cyan
$token = (az account get-access-token --resource "$OrgUrl" --query accessToken -o tsv 2>$null)
if (-not $token) { Write-Error "Could not get token. Run 'az login' first."; exit 1 }
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json"; "OData-MaxVersion" = "4.0"; "OData-Version" = "4.0"; Accept = "application/json" }
$base = "$OrgUrl/api/data/v9.2"

$pubs = Invoke-RestMethod -Uri "$base/publishers?`$filter=isreadonly eq false&`$select=customizationprefix" -Headers $headers
$prefix = ($pubs.value | Where-Object { $_.customizationprefix -and $_.customizationprefix -ne 'new' } | Select-Object -First 1).customizationprefix
if (-not $prefix) { $prefix = "new" }
Write-Host "  Using publisher prefix: $prefix" -ForegroundColor Green

function Label($text) { @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $text; LanguageCode = 1033 }) } }
function Optional() { @{ "@odata.type" = "Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty"; Value = "None"; CanBeChanged = $true; ManagedPropertyLogicalName = "canmodifyrequirementlevelsettings" } }

function TableExists($logicalName) {
    try { Invoke-RestMethod -Uri "$base/EntityDefinitions(LogicalName='$logicalName')?`$select=LogicalName" -Headers $headers -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}
function ColumnExists($tableLogical, $colLogical) {
    try { Invoke-RestMethod -Uri "$base/EntityDefinitions(LogicalName='$tableLogical')/Attributes(LogicalName='$colLogical')?`$select=LogicalName" -Headers $headers -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}
function RelationshipExists($schemaName) {
    try { Invoke-RestMethod -Uri "$base/RelationshipDefinitions(SchemaName='$schemaName')?`$select=SchemaName" -Headers $headers -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}
function AddColumn($tableLogical, $colLogical, $body) {
    if (ColumnExists $tableLogical $colLogical) { Write-Host "  Column '$colLogical' already exists - skipping." -ForegroundColor Yellow; return }
    Write-Host "  Adding column '$colLogical'..." -ForegroundColor White
    Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions(LogicalName='$tableLogical')/Attributes" -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
}
function StringBody($schema, $label, $max) {
    @{ "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"; SchemaName = $schema; MaxLength = $max; RequiredLevel = Optional; DisplayName = Label $label }
}

$reportsTable = "${prefix}_vacancyreports"
$auditTable   = "${prefix}_reportaudit"

# --- Audit table ---
if (-not (TableExists $auditTable)) {
    Write-Host "Creating table '$auditTable'..." -ForegroundColor White
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.EntityMetadata"
        SchemaName = $auditTable
        DisplayName = Label "Report Audit Entry"
        DisplayCollectionName = Label "Report Audit Entries"
        OwnershipType = "UserOwned"
        IsActivity = $false; HasActivities = $false; HasNotes = $false
        PrimaryNameAttribute = "${prefix}_name"
        Attributes = @(
            @{
                "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
                SchemaName = "${prefix}_Name"; IsPrimaryName = $true; FormatName = @{ Value = "Text" }
                RequiredLevel = @{ "@odata.type" = "Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty"; Value = "ApplicationRequired"; CanBeChanged = $true; ManagedPropertyLogicalName = "canmodifyrequirementlevelsettings" }
                MaxLength = 200; DisplayName = Label "Summary"
            }
        )
    } | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions" -Headers $headers -Body $body | Out-Null
    Start-Sleep -Seconds 5
} else {
    Write-Host "Table '$auditTable' already exists - skipping." -ForegroundColor Yellow
}

AddColumn $auditTable "${prefix}_action"  (StringBody "${prefix}_Action"  "Action"        50)
AddColumn $auditTable "${prefix}_actor"   (StringBody "${prefix}_Actor"   "Done By"       200)
AddColumn $auditTable "${prefix}_details" @{
    "@odata.type" = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"; SchemaName = "${prefix}_Details"; MaxLength = 4000
    RequiredLevel = Optional; DisplayName = Label "Details"
}

# Lookup to the report (optional, so a deleted report just leaves its history unlinked rather than blocking the delete).
$rel = "${prefix}_vacancyreport_reportaudit"
if (-not (RelationshipExists $rel)) {
    Write-Host "  Creating relationship '$rel'..." -ForegroundColor White
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata"
        SchemaName = $rel; ReferencedEntity = $reportsTable; ReferencingEntity = $auditTable
        Lookup = @{
            "@odata.type" = "Microsoft.Dynamics.CRM.LookupAttributeMetadata"
            SchemaName = "${prefix}_vacancyreport"; RequiredLevel = Optional; DisplayName = Label "Vacancy Report"
        }
    } | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Method Post -Uri "$base/RelationshipDefinitions" -Headers $headers -Body $body | Out-Null
    Start-Sleep -Seconds 3
} else {
    Write-Host "  Relationship '$rel' already exists - skipping." -ForegroundColor Yellow
}

# --- Last edited columns on the report ---
AddColumn $reportsTable "${prefix}_lasteditedby" (StringBody "${prefix}_LastEditedBy" "Last Edited By" 200)
AddColumn $reportsTable "${prefix}_lasteditedon" @{
    "@odata.type" = "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata"; SchemaName = "${prefix}_LastEditedOn"
    Format = "DateAndTime"; DateTimeBehavior = @{ Value = "UserLocal" }
    RequiredLevel = Optional; DisplayName = Label "Last Edited On"
}

Write-Host "`nDone. Next: add the new table/columns to your solution, then in the code app run" -ForegroundColor Green
Write-Host "  npx power-apps add-data-source -a dataverse -t ${prefix}_reportaudit" -ForegroundColor Green
Write-Host "  npx power-apps refresh-data-source -n vm_vacancyreports --non-interactive" -ForegroundColor Green
Write-Host "and give the member and admin roles Read/Create on the new table (see DEPLOYMENT_GUIDE.md Step 8)." -ForegroundColor Green
