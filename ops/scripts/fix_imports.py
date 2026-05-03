"""Fix broken relative imports after monorepo restructure."""
import os
import re

REPO_ROOT = r'F:\mcp-brunella-core'
ROOTS = [
    r'F:\mcp-brunella-core\apps\mcp-core',
    r'F:\mcp-brunella-core\apps\dashboard\lib',
    r'F:\mcp-brunella-core\apps\dashboard\data',
    r'F:\mcp-brunella-core\packages\agents',
    r'F:\mcp-brunella-core\packages\core-logic',
]
count = 0

patterns = [
    # Already-fixed packages (keep idempotent)
    (re.compile(r"(['\"])(\.\.\/)+agents/"), r'\1@packages/agents/'),
    (re.compile(r"(['\"])(\.\.\/)+utils/"), r'\1@packages/utils/'),
    (re.compile(r"(['\"])(\.\.\/)+types/"), r'\1@packages/types/'),
    (re.compile(r"(['\"])(\.\.\/)+core-logic/"), r'\1@packages/core-logic/'),
    (re.compile(r"(['\"])(\.\.\/)+database/"), r'\1@packages/database/'),
    # Second pass patterns
    (re.compile(r"(['\"])(\.\.\/)+core/"), r'\1@packages/core-logic/'),
    (re.compile(r"(['\"])(\.\.\/)+data/"), r'\1@packages/utils/'),
    (re.compile(r"(['\"])(\.\.\/)+security/"), r'\1@packages/core-logic/'),
    (re.compile(r"(['\"])(\.\.\/)+services/"), r'\1@packages/core-logic/'),
    (re.compile(r"(['\"])(\.\.\/)+tools/"), r'\1@packages/utils/'),
    (re.compile(r"(['\"])(\.\.\/)+cloudflare/"), r'\1@packages/core-logic/cloudflare/'),
    # Third pass patterns
    (re.compile(r"(['\"])(\.\.\/)+config/"), r'\1@packages/utils/'),
    (re.compile(r"(['\"])(\.\.\/)+mesh/"), r'\1@packages/core-logic/'),
    (re.compile(r"(['\"])(\.\.\/)+pipeline/"), r'\1@packages/core-logic/'),
    (re.compile(r"(['\"])(\.\.\/)+integrations/openclaw/"), r'\1@packages/core-logic/openclaw/'),
    # 3-level-up packages reference
    (re.compile(r"(['\"])\.\.\/\.\.\/\.\.\/packages\/agents/"), r'\1@packages/agents/'),
    # Wrong package alias corrections
    (re.compile(r"(['\"])@packages/security/"), r'\1@packages/core-logic/'),
    # Services in subdir - fix ALL service files that live in services/ subdir
    (re.compile(r"(['\"])@packages/core-logic/(briefingService|crmFollowUpExecutionService|externalKnowledgeService|heygenService|hrTimesheetService|hrTimesheetStatusSnapshot|kkvCrmService|projectMaintainerService)\.js(['\"])"), r'\1@packages/core-logic/services/\2.js\3'),
    # hrTimesheetStatus is in types not agents
    (re.compile(r"(['\"])@packages/agents/hrTimesheetStatus\.js(['\"])"), r'\1@packages/types/hrTimesheetStatus.js\2'),
]

for root in ROOTS:
    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            if not fn.endswith('.ts'):
                continue
            fp = os.path.join(dirpath, fn)
            with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            new_content = content
            for pat, rep in patterns:
                new_content = pat.sub(rep, new_content)
            if new_content != content:
                with open(fp, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                rel = fp.replace(REPO_ROOT + '\\', '')
                print(f'Fixed: {rel}')
                count += 1

print(f'Total: {count} files updated')
