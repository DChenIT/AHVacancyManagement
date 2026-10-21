# setup-unit-comments.ps1
# Adds the per-unit comment threads shown on the Report Preview:
#   cr1e9_unitcomment - one row per comment (who, when, text). A comment is tied to a unit by a key
#   (community id + unit number), not to one week's report, so the discussion follows the unit from week to week.
# There is deliberately no lookup to a report or unit row, so the roles need no Append / Append To for it.
# Idempotent - safe to re-run. Not needed when you import the solution, which carries the table.
#
# Usage:
#   .\scripts\setup-unit-comments.ps1
#   .\scripts\setup-unit-comments.ps1 -OrgUrl "https://yourorg.crm.dynamics.com"

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
function AddColumn($tableLogical, $colLogical, $body) {
    if (ColumnExists $tableLogical $colLogical) { Write-Host "  Column '$colLogical' already exists - skipping." -ForegroundColor Yellow; return }
    Write-Host "  Adding column '$colLogical'..." -ForegroundColor White
    Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions(LogicalName='$tableLogical')/Attributes" -Headers $headers -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
}
function StringBody($schema, $label, $max) {
    @{ "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"; SchemaName = $schema; MaxLength = $max; RequiredLevel = Optional; DisplayName = Label $label }
}

$table = "${prefix}_unitcomment"

if (-not (TableExists $table)) {
    Write-Host "Creating table '$table'..." -ForegroundColor White
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.EntityMetadata"
        SchemaName = $table
        DisplayName = Label "Unit Comment"
        DisplayCollectionName = Label "Unit Comments"
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
    Write-Host "Table '$table' already exists - skipping." -ForegroundColor Yellow
}

AddColumn $table "${prefix}_comment" @{
    "@odata.type" = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"; SchemaName = "${prefix}_Comment"; MaxLength = 4000
    RequiredLevel = Optional; DisplayName = Label "Comment"
}
AddColumn $table "${prefix}_author"      (StringBody "${prefix}_Author"      "Author"       200)
AddColumn $table "${prefix}_authoremail" (StringBody "${prefix}_AuthorEmail" "Author Email" 200)
AddColumn $table "${prefix}_unitkey"     (StringBody "${prefix}_UnitKey"     "Unit Key"     200)
AddColumn $table "${prefix}_unitnumber"  (StringBody "${prefix}_UnitNumber"  "Unit Number"  100)
AddColumn $table "${prefix}_reportdate" @{
    "@odata.type" = "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata"; SchemaName = "${prefix}_ReportDate"
    Format = "DateOnly"; DateTimeBehavior = @{ Value = "DateOnly" }
    RequiredLevel = Optional; DisplayName = Label "Report Date"
}

Write-Host "`nDone. Next: add the table to your solution, then in the code app run" -ForegroundColor Green
Write-Host "  npx power-apps add-data-source -a dataverse -t ${prefix}_unitcomment -u $OrgUrl" -ForegroundColor Green
Write-Host "and give the roles privileges on Unit Comments (see DEPLOYMENT_GUIDE.md Step 8)." -ForegroundColor Green
