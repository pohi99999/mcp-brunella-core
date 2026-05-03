"""Fix broken ../src/ imports in test files after monorepo restructure.

Tests in tests/test/ still use ../src/ which maps to the OLD flat src/ layout.
New layout:
  src/utils/       -> packages/utils/         (@packages/utils)
  src/core/        -> packages/core-logic/    (@packages/core-logic)
  src/agents/      -> packages/agents/        (@packages/agents)
  src/tools/       -> packages/utils/         (@packages/utils)
  src/config/      -> packages/utils/         (@packages/utils)
  src/types/       -> packages/types/         (@packages/types)
  src/database/    -> packages/database/      (@packages/database)
  src/server/      -> apps/mcp-core/server/   (@apps/mcp-core/server)
  src/cli/         -> apps/mcp-core/commands/ (@apps/mcp-core/commands)
"""
import re
import os

REPO_ROOT = r'F:\mcp-brunella-core'
ROOTS = [
    r'F:\mcp-brunella-core\tests\test',
]

# Ordered: most specific patterns first
patterns = [
    # Exact ../src/ sub-path remappings
    (re.compile(r"(['\"])\.\.\/src\/utils\/"), r'\1@packages/utils/'),
    (re.compile(r"(['\"])\.\.\/src\/core\/"), r'\1@packages/core-logic/'),
    (re.compile(r"(['\"])\.\.\/src\/agents\/"), r'\1@packages/agents/'),
    (re.compile(r"(['\"])\.\.\/src\/tools\/"), r'\1@packages/utils/'),
    (re.compile(r"(['\"])\.\.\/src\/config\/"), r'\1@packages/utils/'),
    (re.compile(r"(['\"])\.\.\/src\/types\/"), r'\1@packages/types/'),
    (re.compile(r"(['\"])\.\.\/src\/database\/"), r'\1@packages/database/'),
    (re.compile(r"(['\"])\.\.\/src\/server\/"), r'\1@apps/mcp-core/server/'),
    (re.compile(r"(['\"])\.\.\/src\/cli\/"), r'\1@apps/mcp-core/commands/'),
    (re.compile(r"(['\"])\.\.\/src\/commands\/"), r'\1@apps/mcp-core/commands/'),
    # Wrong package alias corrections
    (re.compile(r"(['\"])@packages/security\/"), r'\1@packages/core-logic/'),
    # Services in subdir
    (re.compile(
        r"(['\"])@packages/core-logic/(briefingService|crmFollowUpExecutionService|"
        r"externalKnowledgeService|heygenService|hrTimesheetService|"
        r"hrTimesheetStatusSnapshot|kkvCrmService|projectMaintainerService)\.js(['\"])"),
        r'\1@packages/core-logic/services/\2.js\3'),
]

count = 0
for root in ROOTS:
    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            if not fn.endswith(('.ts', '.js')):
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
