# Targeted fixes for the seed generators.
#
# These are type-correctness repairs found by the first `tsc` run over the mock-services
# package. Each entry records what was wrong, so the change is reviewable rather than a
# silent mass edit. ASCII-only: Windows PowerShell 5.1 mis-decodes UTF-8 without a BOM.

$root = Join-Path $PSScriptRoot '..'

function Edit-File {
    param([string]$RelativePath, [hashtable[]]$Replacements)
    $path = Join-Path $root $RelativePath
    $text = Get-Content -Raw -LiteralPath $path
    $original = $text
    foreach ($entry in $Replacements) {
        if ($text -notmatch [regex]::Escape($entry.From)) {
            Write-Output ("  MISS in {0}: {1}" -f $RelativePath, $entry.From.Substring(0, [Math]::Min(60, $entry.From.Length)))
            continue
        }
        $text = $text.Replace($entry.From, $entry.To)
    }
    if ($text -ne $original) {
        Set-Content -LiteralPath $path -Value $text -NoNewline -Encoding utf8
        Write-Output ("  patched {0}" -f $RelativePath)
    }
}

Write-Output 'foundation.ts'

Edit-File 'packages\mock-services\src\seed\foundation.ts' @(
    @{ From = '  companyStems,'
       To   = '' }
    # User is Auditable: createdAt / updatedAt are required.
    @{ From = "    lastActiveAt: toDateTimeString(new Date(DATASET_EPOCH.getTime() - random.int(1, 72) * 3_600_000)),`n    activatedAt: toDateTimeString(new Date('2024-11-04T10:00:00.000Z')),`n  };"
       To   = "    lastActiveAt: toDateTimeString(new Date(DATASET_EPOCH.getTime() - random.int(1, 72) * 3_600_000)),`n    activatedAt: toDateTimeString(new Date('2024-11-04T10:00:00.000Z')),`n    createdAt: toDateTimeString(new Date('2024-11-04T09:55:00.000Z')),`n    updatedAt: toDateTimeString(new Date('2026-10-10T08:30:00.000Z')),`n  };" }
    # makeTeams receives the blueprint and does use its organization short name, but the
    # parameter was unused after a refactor. Keep it for team naming and record the use.
    @{ From = '      description: `${blueprint.name} at ${bp.organization.shortName}.`,'
       To   = '      description: `${blueprint.name} at ${bp.organization.name}.`,'
       }
)

Write-Output 'index.ts'

Edit-File 'packages\mock-services\src\seed\index.ts' @(
    # locale lives on User, not on UserPreferences.
    @{ From = "      const preferences = defaultPreferences();`n      preferences.locale = ctx.organization.defaultLocale;`n      preferences.tablePageSize = 50;"
       To   = "      const preferences = defaultPreferences();`n      preferences.tablePageSize = 50;" }
    # Organization has `slug`, not `domain`. The tenant contact email uses the org slug.
    @{ From = "email: `new.hire${index + 1}@${ctx.organization.domain}`,"
       To   = "email: `new.hire${index + 1}@${ctx.organization.slug}.example`," }
)

Write-Output 'records-engage.ts'

Edit-File 'packages\mock-services\src\seed\records-engage.ts' @(
    @{ From = "import { campaignNames, cities, kbArticleTitles, ticketSubjects } from './pools';"
       To   = "import { campaignNames, kbArticleTitles, ticketSubjects } from './pools';" }
    # `thread[0].createdAt` is optional on the base message shape; fall back to the thread time.
    @{ From = "firstResponseDueAt: toDateTimeString(addDays(thread[0]!.createdAt ? new Date(thread[0]!.createdAt) : lastMessageAt, 0.5)),"
       To   = "firstResponseDueAt: toDateTimeString(addDays(thread[0]?.createdAt ? new Date(thread[0].createdAt!) : lastMessageAt, 0.5))," }
    # EmailBlock.visible is required so the editor can hide a block without deleting it.
    @{ From = "      { id: `b-${index}-1`, type: 'heading', content: { text: name } },`n      { id: `b-${index}-2`, type: 'paragraph', content: { text: 'Hello {{contact.first_name}}, here is a summary of what has changed and what it means for {{account.name}}.' } },`n      { id: `b-${index}-3`, type: 'image_placeholder', content: { alt: 'Product screenshot placeholder' } },`n      { id: `b-${index}-4`, type: 'button', content: { label: 'Read the full update', href: 'https://example-crm.test/blog' } },`n      { id: `b-${index}-5`, type: 'unsubscribe', content: { label: 'Manage subscription preferences' } },"
       To   = "      { id: `b-${index}-1`, type: 'heading', content: { text: name }, visible: true },`n      { id: `b-${index}-2`, type: 'paragraph', content: { text: 'Hello {{contact.first_name}}, here is a summary of what has changed and what it means for {{account.name}}.' }, visible: true },`n      { id: `b-${index}-3`, type: 'image_placeholder', content: { alt: 'Product screenshot placeholder' }, visible: true },`n      { id: `b-${index}-4`, type: 'button', content: { label: 'Read the full update', href: 'https://example-crm.test/blog' }, visible: true },`n      { id: `b-${index}-5`, type: 'unsubscribe', content: { label: 'Manage subscription preferences' }, visible: true }," }
    # 'inside_sales' is not one of the 17 personas. Remove it from the filter.
    @{ From = "user.persona === 'support_agent' || user.persona === 'inside_sales' || user.persona === 'sales_rep'"
       To   = "user.persona === 'support_agent' || user.persona === 'sales_rep'" }
    # addDays takes a Date; the message timestamp is a string.
    @{ From = "        createdAt: toDateTimeString(addDays(resolvedAt, 0.3)),"
       To   = "        submittedAt: toDateTimeString(addDays(resolvedAt, 0.3))," }
    # MessageTemplate and CannedResponse are Auditable.
    @{ From = "      isActive: true,`n      category: 'follow_up',`n    },"
       To   = "      isActive: true,`n      category: 'follow_up',`n      createdAt: toDateTimeString(new Date('2025-02-10T09:00:00.000Z')),`n      updatedAt: toDateTimeString(new Date('2026-09-12T11:00:00.000Z')),`n    }," }
    @{ From = "      isActive: true,`n      category: 'renewal',`n    },"
       To   = "      isActive: true,`n      category: 'renewal',`n      createdAt: toDateTimeString(new Date('2025-03-04T09:00:00.000Z')),`n      updatedAt: toDateTimeString(new Date('2026-08-02T14:00:00.000Z')),`n    }," }
    @{ From = "      isActive: true,`n      category: 'reminder',`n    },"
       To   = "      isActive: true,`n      category: 'reminder',`n      createdAt: toDateTimeString(new Date('2025-06-01T09:00:00.000Z')),`n      updatedAt: toDateTimeString(new Date('2026-07-15T10:00:00.000Z')),`n    }," }
)

# The four canned responses share one shape; append the audit fields to each.
$engagePath = Join-Path $root 'packages\mock-services\src\seed\records-engage.ts'
$engage = Get-Content -Raw -LiteralPath $engagePath
$engage = [regex]::Replace($engage, "(usageCount: random\.int\(\d+, \d+\), isActive: true \})", '$1')
$engage = $engage.Replace(
    "usageCount: random.int(200, 900), isActive: true }",
    "usageCount: random.int(200, 900), isActive: true, createdAt: toDateTimeString(new Date('2024-12-02T09:00:00.000Z')), updatedAt: toDateTimeString(new Date('2026-09-01T09:00:00.000Z')) }")
$engage = $engage.Replace(
    "usageCount: random.int(80, 400), isActive: true }",
    "usageCount: random.int(80, 400), isActive: true, createdAt: toDateTimeString(new Date('2024-12-02T09:05:00.000Z')), updatedAt: toDateTimeString(new Date('2026-08-20T09:00:00.000Z')) }")
$engage = $engage.Replace(
    "usageCount: random.int(300, 1200), isActive: true }",
    "usageCount: random.int(300, 1200), isActive: true, createdAt: toDateTimeString(new Date('2024-12-02T09:10:00.000Z')), updatedAt: toDateTimeString(new Date('2026-09-18T09:00:00.000Z')) }")
$engage = $engage.Replace(
    "usageCount: random.int(20, 160), isActive: true }",
    "usageCount: random.int(20, 160), isActive: true, createdAt: toDateTimeString(new Date('2025-01-08T09:00:00.000Z')), updatedAt: toDateTimeString(new Date('2026-07-04T09:00:00.000Z')) }")
Set-Content -LiteralPath $engagePath -Value $engage -NoNewline -Encoding utf8
Write-Output '  patched canned responses'

Write-Output 'records-extra.ts'

Edit-File 'packages\mock-services\src\seed\records-extra.ts' @(
    @{ From = "import type {`n  Account,`n  Activity,"
       To   = "import type {`n  Account," }
    @{ From = "  Contract,`n  CustomerSatisfaction,"
       To   = "  Contract," }
    @{ From = "import { DATASET_EPOCH, addDays, toDateString, toDateTimeString } from '../lib/random';"
       To   = "import { DATASET_EPOCH, addDays, createRandom, toDateString, toDateTimeString } from '../lib/random';" }
    # SuccessPlan.risk status union is open | mitigated | accepted.
    @{ From = "severity: 'high' as const, mitigation: 'Run a targeted enablement session', status: 'mitigating' as const }"
       To   = "severity: 'high' as const, mitigation: 'Run a targeted enablement session', status: 'mitigated' as const }" }
    # FeedItem.actorKind is a narrow union; annotate the ternary.
    @{ From = "      actorKind: isAutomation ? 'automation' : 'user',"
       To   = "      actorKind: (isAutomation ? 'automation' : 'user') as FeedItem['actorKind']," }
    # Notification kind union spells it `ticket_sla_breach`.
    @{ From = "  const notificationKinds: Array<Notification['kind']> = ['assignment', 'mention', 'task_due', 'task_overdue', 'deal_won', 'ticket_escalated', 'sla_threat', 'approval_request', 'comment_reply', 'export_ready', 'security_alert', 'announcement'];"
       To   = "  const notificationKinds: Array<Notification['kind']> = ['assignment', 'mention', 'task_due', 'task_overdue', 'deal_won', 'ticket_escalated', 'ticket_sla_breach', 'approval_request', 'comment_reply', 'export_ready', 'security_alert', 'announcement'];" }
    @{ From = "      kind: kind === 'sla_threat' ? 'ticket_sla_breach' : kind,"
       To   = "      kind," }
)

Write-Output 'done'
