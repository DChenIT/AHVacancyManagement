# setup-dataverse.ps1
# Creates the 5 Dataverse tables needed by the Vacancy Management app:
# Communities, VacancyReports, UnitUpdates, ApplicantUpdateHistory, ReportConfiguration.
# Idempotent - safe to re-run; skips anything that already exists.
#
# Usage:
#   .\scripts\setup-dataverse.ps1
#   .\scripts\setup-dataverse.ps1 -OrgUrl "https://yourorg.crm.dynamics.com"
#
# Requirements:
#   - Azure CLI installed and logged in (az login)
#   - System Administrator or System Customizer role in the target environment

param(
    [Parameter()][string]$OrgUrl = "https://orge3242d73.crm.dynamics.com"
)

$OrgUrl = $OrgUrl.TrimEnd('/')

# --- Auth ---
Write-Host "Getting Azure AD token..." -ForegroundColor Cyan
$token = (az account get-access-token --resource "$OrgUrl" --query accessToken -o tsv 2>$null)
if (-not $token) {
    Write-Error "Could not get token. Run 'az login' first and make sure you have access to $OrgUrl."
    exit 1
}
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json"; "OData-MaxVersion" = "4.0"; "OData-Version" = "4.0"; Accept = "application/json" }
$base = "$OrgUrl/api/data/v9.2"

# --- Discover publisher prefix ---
Write-Host "Discovering publisher prefix..." -ForegroundColor Cyan
$pubs = Invoke-RestMethod -Uri "$base/publishers?`$filter=isreadonly eq false&`$select=customizationprefix" -Headers $headers
$prefix = ($pubs.value | Where-Object { $_.customizationprefix -and $_.customizationprefix -ne 'new' } | Select-Object -First 1).customizationprefix
if (-not $prefix) { $prefix = "new" }
Write-Host "  Using publisher prefix: $prefix" -ForegroundColor Green

function TableExists($logicalName) {
    try {
        Invoke-RestMethod -Uri "$base/EntityDefinitions(LogicalName='$logicalName')?`$select=LogicalName" -Headers $headers -ErrorAction Stop | Out-Null
        return $true
    } catch { return $false }
}

function ColumnExists($tableLogical, $colLogical) {
    try {
        Invoke-RestMethod -Uri "$base/EntityDefinitions(LogicalName='$tableLogical')/Attributes(LogicalName='$colLogical')?`$select=LogicalName" -Headers $headers -ErrorAction Stop | Out-Null
        return $true
    } catch { return $false }
}

function RelationshipExists($schemaName) {
    try {
        Invoke-RestMethod -Uri "$base/RelationshipDefinitions(SchemaName='$schemaName')?`$select=SchemaName" -Headers $headers -ErrorAction Stop | Out-Null
        return $true
    } catch { return $false }
}

function CreateTableIfMissing($logicalName, $displayName, $pluralName, $primaryNameLabel) {
    if (TableExists $logicalName) {
        Write-Host "  Table '$logicalName' already exists - skipping." -ForegroundColor Yellow
        return
    }
    Write-Host "  Creating table '$logicalName'..." -ForegroundColor White
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.EntityMetadata"
        SchemaName = $logicalName
        DisplayName = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $displayName; LanguageCode = 1033 }) }
        DisplayCollectionName = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $pluralName; LanguageCode = 1033 }) }
        IsActivity = $false
        HasActivities = $false
        HasNotes = $false
        OwnershipType = "UserOwned"
        PrimaryNameAttribute = "${prefix}_name"
        Attributes = @(
            @{
                "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
                SchemaName = "${prefix}_Name"
                IsPrimaryName = $true
                FormatName = @{ Value = "Text" }
                RequiredLevel = @{ "@odata.type" = "Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty"; Value = "ApplicationRequired"; CanBeChanged = $true; ManagedPropertyLogicalName = "canmodifyrequirementlevelsettings" }
                MaxLength = 200
                DisplayName = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $primaryNameLabel; LanguageCode = 1033 }) }
            }
        )
    } | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions" -Headers $headers -Body $body | Out-Null
    Write-Host "  Created '$logicalName'." -ForegroundColor Green
    Start-Sleep -Seconds 5
}

function AddStringColumn($tableLogical, $schemaName, $displayLabel, $maxLength = 500, $required = $false) {
    $colLogical = "${prefix}_${schemaName}".ToLower()
    if (ColumnExists $tableLogical $colLogical) {
        Write-Host "    Column '$colLogical' already exists - skipping." -ForegroundColor Yellow
        return
    }
    Write-Host "    Adding string column '$colLogical'..." -ForegroundColor White
    $req = if ($required) { "ApplicationRequired" } else { "None" }
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
        SchemaName = "${prefix}_${schemaName}"
        MaxLength = $maxLength
        RequiredLevel = @{ "@odata.type" = "Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty"; Value = $req; CanBeChanged = $true; ManagedPropertyLogicalName = "canmodifyrequirementlevelsettings" }
        DisplayName = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $displayLabel; LanguageCode = 1033 }) }
    } | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions(LogicalName='$tableLogical')/Attributes" -Headers $headers -Body $body | Out-Null
}

function AddMemoColumn($tableLogical, $schemaName, $displayLabel) {
    $colLogical = "${prefix}_${schemaName}".ToLower()
    if (ColumnExists $tableLogical $colLogical) {
        Write-Host "    Column '$colLogical' already exists - skipping." -ForegroundColor Yellow
        return
    }
    Write-Host "    Adding memo column '$colLogical'..." -ForegroundColor White
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"
        SchemaName = "${prefix}_${schemaName}"
        MaxLength = 4000
        RequiredLevel = @{ "@odata.type" = "Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty"; Value = "None"; CanBeChanged = $true; ManagedPropertyLogicalName = "canmodifyrequirementlevelsettings" }
        DisplayName = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $displayLabel; LanguageCode = 1033 }) }
    } | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions(LogicalName='$tableLogical')/Attributes" -Headers $headers -Body $body | Out-Null
}

function AddDateColumn($tableLogical, $schemaName, $displayLabel, $required = $false) {
    $colLogical = "${prefix}_${schemaName}".ToLower()
    if (ColumnExists $tableLogical $colLogical) {
        Write-Host "    Column '$colLogical' already exists - skipping." -ForegroundColor Yellow
        return
    }
    Write-Host "    Adding date column '$colLogical'..." -ForegroundColor White
    $req = if ($required) { "ApplicationRequired" } else { "None" }
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata"
        SchemaName = "${prefix}_${schemaName}"
        Format = "DateOnly"
        DateTimeBehavior = @{ Value = "DateOnly" }
        RequiredLevel = @{ "@odata.type" = "Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty"; Value = $req; CanBeChanged = $true; ManagedPropertyLogicalName = "canmodifyrequirementlevelsettings" }
        DisplayName = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $displayLabel; LanguageCode = 1033 }) }
    } | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions(LogicalName='$tableLogical')/Attributes" -Headers $headers -Body $body | Out-Null
}

function AddWholeNumberColumn($tableLogical, $schemaName, $displayLabel, $required = $false) {
    $colLogical = "${prefix}_${schemaName}".ToLower()
    if (ColumnExists $tableLogical $colLogical) {
        Write-Host "    Column '$colLogical' already exists - skipping." -ForegroundColor Yellow
        return
    }
    Write-Host "    Adding whole number column '$colLogical'..." -ForegroundColor White
    $req = if ($required) { "ApplicationRequired" } else { "None" }
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.IntegerAttributeMetadata"
        SchemaName = "${prefix}_${schemaName}"
        MinValue = 0
        MaxValue = 999999
        Format = "None"
        RequiredLevel = @{ "@odata.type" = "Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty"; Value = $req; CanBeChanged = $true; ManagedPropertyLogicalName = "canmodifyrequirementlevelsettings" }
        DisplayName = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $displayLabel; LanguageCode = 1033 }) }
    } | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions(LogicalName='$tableLogical')/Attributes" -Headers $headers -Body $body | Out-Null
}

function AddBooleanColumn($tableLogical, $schemaName, $displayLabel) {
    $colLogical = "${prefix}_${schemaName}".ToLower()
    if (ColumnExists $tableLogical $colLogical) {
        Write-Host "    Column '$colLogical' already exists - skipping." -ForegroundColor Yellow
        return
    }
    Write-Host "    Adding yes/no column '$colLogical'..." -ForegroundColor White
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.BooleanAttributeMetadata"
        SchemaName = "${prefix}_${schemaName}"
        RequiredLevel = @{ "@odata.type" = "Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty"; Value = "None"; CanBeChanged = $true; ManagedPropertyLogicalName = "canmodifyrequirementlevelsettings" }
        DisplayName = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $displayLabel; LanguageCode = 1033 }) }
        OptionSet = @{
            "@odata.type" = "Microsoft.Dynamics.CRM.BooleanOptionSetMetadata"
            TrueOption = @{ Value = 1; Label = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = "Yes"; LanguageCode = 1033 }) } }
            FalseOption = @{ Value = 0; Label = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = "No"; LanguageCode = 1033 }) } }
        }
    } | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions(LogicalName='$tableLogical')/Attributes" -Headers $headers -Body $body | Out-Null
}

function AddChoiceColumn($tableLogical, $schemaName, $displayLabel, $optionLabels, $required = $false) {
    $colLogical = "${prefix}_${schemaName}".ToLower()
    if (ColumnExists $tableLogical $colLogical) {
        Write-Host "    Column '$colLogical' already exists - skipping." -ForegroundColor Yellow
        return
    }
    Write-Host "    Adding choice column '$colLogical'..." -ForegroundColor White
    $req = if ($required) { "ApplicationRequired" } else { "None" }
    $options = @()
    $val = 100000000
    foreach ($lbl in $optionLabels) {
        $options += @{ "@odata.type" = "Microsoft.Dynamics.CRM.OptionMetadata"; Value = $val; Label = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $lbl; LanguageCode = 1033 }) } }
        $val++
    }
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.PicklistAttributeMetadata"
        SchemaName = "${prefix}_${schemaName}"
        RequiredLevel = @{ "@odata.type" = "Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty"; Value = $req; CanBeChanged = $true; ManagedPropertyLogicalName = "canmodifyrequirementlevelsettings" }
        DisplayName = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $displayLabel; LanguageCode = 1033 }) }
        OptionSet = @{
            "@odata.type" = "Microsoft.Dynamics.CRM.OptionSetMetadata"
            IsGlobal = $false
            OptionSetType = "Picklist"
            Options = $options
        }
    } | ConvertTo-Json -Depth 15
    Invoke-RestMethod -Method Post -Uri "$base/EntityDefinitions(LogicalName='$tableLogical')/Attributes" -Headers $headers -Body $body | Out-Null
}

function AddLookupRelationship($relationshipSchemaName, $referencedTable, $referencingTable, $lookupSchemaName, $lookupDisplayLabel, $required = $false) {
    if (RelationshipExists $relationshipSchemaName) {
        Write-Host "    Relationship '$relationshipSchemaName' already exists - skipping." -ForegroundColor Yellow
        return
    }
    Write-Host "    Creating relationship '$relationshipSchemaName' ($referencedTable -> $referencingTable)..." -ForegroundColor White
    $req = if ($required) { "ApplicationRequired" } else { "None" }
    $body = @{
        "@odata.type" = "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata"
        SchemaName = $relationshipSchemaName
        ReferencedEntity = $referencedTable
        ReferencingEntity = $referencingTable
        Lookup = @{
            "@odata.type" = "Microsoft.Dynamics.CRM.LookupAttributeMetadata"
            SchemaName = "${prefix}_${lookupSchemaName}"
            RequiredLevel = @{ "@odata.type" = "Microsoft.Dynamics.CRM.AttributeRequiredLevelManagedProperty"; Value = $req; CanBeChanged = $true; ManagedPropertyLogicalName = "canmodifyrequirementlevelsettings" }
            DisplayName = @{ "@odata.type" = "Microsoft.Dynamics.CRM.Label"; LocalizedLabels = @(@{ "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"; Label = $lookupDisplayLabel; LanguageCode = 1033 }) }
        }
    } | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Method Post -Uri "$base/RelationshipDefinitions" -Headers $headers -Body $body | Out-Null
    Start-Sleep -Seconds 3
}

# ============================
# 1. Communities table
# ============================
$communitiesTable = "${prefix}_communities"
Write-Host "`nSetting up Communities table ($communitiesTable)..." -ForegroundColor Cyan
CreateTableIfMissing $communitiesTable "Community" "Communities" "Community Name"
AddStringColumn      $communitiesTable "communitycode"           "Community Code"           50  $false
AddBooleanColumn      $communitiesTable "active"                  "Active"
AddWholeNumberColumn  $communitiesTable "hoppergoal"              "Hopper Goal"
AddStringColumn       $communitiesTable "regionalmanager"         "Regional Manager"         200 $false
AddStringColumn       $communitiesTable "propertymanager"         "Property Manager"         200 $false
AddMemoColumn         $communitiesTable "defaultreportrecipients" "Default Report Recipients"

# ============================
# 2. VacancyReports table
# ============================
$reportsTable = "${prefix}_vacancyreports"
Write-Host "`nSetting up VacancyReports table ($reportsTable)..." -ForegroundColor Cyan
CreateTableIfMissing $reportsTable "Vacancy Report" "Vacancy Reports" "Report Title"
AddDateColumn      $reportsTable "reportdate"           "Report Date" $true
AddChoiceColumn    $reportsTable "reportingperiod"      "Reporting Period" @("Weekly","Monthly","Ad Hoc")
AddChoiceColumn    $reportsTable "reportstatus"         "Report Status" @("Draft","Review Required","Approved") $true
AddStringColumn    $reportsTable "reviewedby"           "Reviewed By" 200 $false
AddDateColumn      $reportsTable "revieweddate"         "Reviewed Date"
AddStringColumn    $reportsTable "approvedby"           "Approved By" 200 $false
AddDateColumn      $reportsTable "approveddate"         "Approved Date"
AddMemoColumn      $reportsTable "generalsupportneeded" "General Support Needed"
AddMemoColumn      $reportsTable "generalchallenges"    "General Challenges"
AddMemoColumn      $reportsTable "additionalnotes"      "Additional Notes"
AddLookupRelationship "${prefix}_community_vacancyreports" $communitiesTable $reportsTable "community" "Community" $true

# ============================
# 3. UnitUpdates table
# ============================
$unitsTable = "${prefix}_unitupdates"
Write-Host "`nSetting up UnitUpdates table ($unitsTable)..." -ForegroundColor Cyan
CreateTableIfMissing $unitsTable "Unit Update" "Unit Updates" "Unit Number"
AddChoiceColumn    $unitsTable "vacancytype"                "Vacancy Type" @("Vacant","NTV","Transfer","Unknown") $true
AddDateColumn      $unitsTable "ntvdate"                    "NTV Date"
AddDateColumn      $unitsTable "expectedvacancydate"        "Expected Vacancy Date"
AddDateColumn      $unitsTable "actualvacancydate"          "Actual Vacancy Date"
AddStringColumn    $unitsTable "currentapplicantname"       "Current Applicant Name" 200 $false
AddChoiceColumn    $unitsTable "currentstatuscategory"      "Current Status Category" @("Rented / Approved","Pending Approval / Compliance","Eligibility File in Progress","Denied / Ineligible","Waitlist","No Applicant","On Hold") $true
AddChoiceColumn    $unitsTable "currentstatusdetail"        "Current Status Detail" @("Rented","Move-In Complete","Approved","Approved - Awaiting Lease Signing","Approved - Awaiting Move-In","Submitted to Compliance","Corrections Requested","Corrections Resubmitted","Pending Approval","Verification Pending","Interview Scheduled","Interview Complete","Eligibility in Progress","Applicant Unresponsive","Denied","Ineligible","Withdrawn","Waitlist","Unit Turn in Progress","No Applicant Assigned")
AddDateColumn      $unitsTable "approvaldate"               "Approval Date"
AddBooleanColumn   $unitsTable "approvedhopper"             "Approved Hopper"
AddMemoColumn      $unitsTable "nextstep"                   "Next Step"
AddStringColumn    $unitsTable "nextstepowner"              "Next Step Owner" 200 $false
AddDateColumn      $unitsTable "nextstepduedate"            "Next Step Due Date"
AddMemoColumn      $unitsTable "supportneeded"              "Support Needed"
AddBooleanColumn   $unitsTable "escalationrequired"         "Escalation Required"
AddStringColumn    $unitsTable "escalationowner"            "Escalation Owner" 200 $false
AddDateColumn      $unitsTable "expectedmoveindate"         "Expected Move-In Date"
AddDateColumn      $unitsTable "actualmoveindate"           "Actual Move-In Date"
AddStringColumn    $unitsTable "turnstatus"                 "Turn Status" 200 $false
AddDateColumn      $unitsTable "expectedturncompletiondate" "Expected Turn Completion Date"
AddMemoColumn      $unitsTable "turnchallenges"              "Turn Challenges"
AddChoiceColumn    $unitsTable "risklevel"                  "Risk Level" @("Low","Medium","High","Critical")
AddStringColumn    $unitsTable "riskowner"                  "Risk Owner" 200 $false
AddDateColumn      $unitsTable "riskresolutiondate"         "Risk Resolution Date"
AddWholeNumberColumn $unitsTable "previousoffercount"       "Previous Offer Count"
AddWholeNumberColumn $unitsTable "previousturndowncount"    "Previous Turndown Count"
AddMemoColumn      $unitsTable "previousturndownreasons"    "Previous Turndown Reasons"
AddMemoColumn      $unitsTable "currentapplicantconcerns"   "Current Applicant Concerns"
AddMemoColumn      $unitsTable "additionalnotes"            "Additional Notes"
AddWholeNumberColumn $unitsTable "displayorder"             "Display Order"
AddLookupRelationship "${prefix}_vacancyreport_unitupdates" $reportsTable $unitsTable "vacancyreport" "Vacancy Report" $true

# ============================
# 4. ApplicantUpdateHistory table
# ============================
$historyTable = "${prefix}_applicantupdatehistory"
Write-Host "`nSetting up ApplicantUpdateHistory table ($historyTable)..." -ForegroundColor Cyan
CreateTableIfMissing $historyTable "Applicant Update History" "Applicant Update Histories" "Applicant Name"
AddDateColumn   $historyTable "updatedate"    "Update Date"
AddStringColumn $historyTable "status"        "Status" 200 $false
AddMemoColumn   $historyTable "updatedetails" "Update Details"
AddLookupRelationship "${prefix}_unitupdate_applicantupdatehistory" $unitsTable $historyTable "unitupdate" "Unit Update" $true

# ============================
# 5. ReportConfiguration table
# ============================
$configTable = "${prefix}_reportconfiguration"
Write-Host "`nSetting up ReportConfiguration table ($configTable)..." -ForegroundColor Cyan
CreateTableIfMissing $configTable "Report Configuration" "Report Configurations" "Status Name"
AddStringColumn      $configTable "summarycategory" "Summary Category" 100 $false
AddStringColumn      $configTable "displaylabel"    "Display Label"    200 $false
AddStringColumn      $configTable "iconname"        "Icon Name"        100 $false
AddWholeNumberColumn $configTable "displayorder"    "Display Order"
AddBooleanColumn     $configTable "active"          "Active"

Write-Host "`nDone! Publisher prefix is: $prefix" -ForegroundColor Green
Write-Host "Tables created: $communitiesTable, $reportsTable, $unitsTable, $historyTable, $configTable" -ForegroundColor Green
