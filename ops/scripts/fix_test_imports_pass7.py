"""Fix remaining broken src/ imports in test files after monorepo restructure - Pass 7.

Handles ALL prefix depths:
  ../src/    (tests/test/*.test.ts)
  ../../src/ (tests/test/agents/*.test.ts, tests/test/federation/*.test.ts, etc.)
  ../../../src/ (tests/test/dashboard/lib/*.test.ts, etc.)

Source location mapping (VERIFIED from build output):
  src/agents/           -> @packages/agents/
  src/agents/middleware/ -> @packages/agents/middleware/
  src/agents/swarm/     -> @packages/agents/swarm/
  src/utils/            -> @packages/utils/
  src/core/             -> @packages/core-logic/
  src/core/federation/  -> @packages/core-logic/federation/
  src/core/swarm/       -> @packages/core-logic/swarm/
  src/core/sandbox/     -> @packages/core-logic/sandbox/
  src/tools/            -> @packages/utils/
  src/config/           -> @packages/utils/
  src/types/            -> @packages/types/
  src/schemas/          -> @packages/types/
  src/database/         -> @packages/database/
  src/server/services/  -> @packages/core-logic/services/
  src/server/           -> @apps/mcp-core/server/
  src/cli/studioRuntime -> @apps/mcp-core/studioRuntime  (special case)
  src/cli/studioCommands -> @apps/mcp-core/studioCommands (special case)
  src/cli/              -> @apps/mcp-core/commands/
  src/commands/         -> @apps/mcp-core/commands/
  src/data/             -> @packages/utils/
  src/security/         -> @packages/core-logic/
  src/services/         -> @packages/core-logic/  (top-level; services subdir handled below)
  src/mesh/             -> @packages/core-logic/
  src/kernel/           -> @packages/core-logic/
  src/infra/            -> @packages/core-logic/
  src/orchestrator/     -> @packages/core-logic/
  src/kkv/              -> @packages/core-logic/
  src/metrics           -> @packages/utils/metrics  (CEAN cloudflare metrics type)
  src/integrations/openclaw/ -> @packages/core-logic/openclaw/
  src/integrations/     -> @packages/core-logic/
  src/dashboard/lib/    -> @/lib/
  src/dashboard/components/ -> @/components/

Post-correction (already in packages/core-logic/services/, not top-level):
  @packages/core-logic/<X>.js  ->  @packages/core-logic/services/<X>.js
  where X is one of: briefingService, crmFollowUpExecutionService,
  externalKnowledgeService, heygenService, hrTimesheetService,
  hrTimesheetStatusSnapshot, kkvCrmService, projectMaintainerService
"""
import re
import os
from collections import defaultdict

REPO_ROOT = r'F:\mcp-brunella-core'
TESTS_ROOT = os.path.join(REPO_ROOT, 'tests')

# Services that live in packages/core-logic/services/ subdir (not top-level)
SERVICES_SUBDIR = {
    'briefingService',
    'crmFollowUpExecutionService',
    'externalKnowledgeService',
    'heygenService',
    'hrTimesheetService',
    'hrTimesheetStatusSnapshot',
    'kkvCrmService',
    'projectMaintainerService',
}
SERVICES_SUBDIR_PATTERN = '|'.join(re.escape(s) for s in SERVICES_SUBDIR)


def build_patterns():
    """Build ordered list of (compiled_regex, replacement) tuples.
    
    Order matters: more specific patterns must come before general ones.
    Each pattern handles both single-quoted and double-quoted imports via
    a capture group (['\\"]) for the quote character.
    """
    rules = []

    # -----------------------------------------------------------------------
    # For each depth prefix (../, ../../, ../../../) apply ALL path mappings
    # -----------------------------------------------------------------------
    depths = [
        (r'\.\.\/', '../'),            # 1 level up: tests/test/*.test.ts
        (r'\.\./\.\.\/', '../../'),    # 2 levels up: tests/test/agents/*.test.ts etc.
        (r'\.\./\.\./\.\.\/', '../../../'),  # 3 levels up: tests/test/dashboard/lib/*.test.ts
    ]

    for rx_depth, _ in depths:
        d = rx_depth  # shorthand

        # --- Most specific sub-paths first ---

        # src/integrations/openclaw/ -> @packages/core-logic/openclaw/
        rules.append((
            re.compile(rf"(['\"]){d}src/integrations/openclaw/"),
            r'\1@packages/core-logic/openclaw/',
        ))
        # src/integrations/ -> @packages/core-logic/
        rules.append((
            re.compile(rf"(['\"]){d}src/integrations/"),
            r'\1@packages/core-logic/',
        ))

        # src/server/services/ -> @packages/core-logic/services/
        rules.append((
            re.compile(rf"(['\"]){d}src/server/services/"),
            r'\1@packages/core-logic/services/',
        ))
        # src/server/ -> @apps/mcp-core/server/
        rules.append((
            re.compile(rf"(['\"]){d}src/server/"),
            r'\1@apps/mcp-core/server/',
        ))

        # src/cli/studioRuntime -> @apps/mcp-core/studioRuntime (no subdir)
        rules.append((
            re.compile(rf"(['\"]){d}src/cli/(studioRuntime)"),
            r'\1@apps/mcp-core/\2',
        ))
        # src/cli/studioCommands -> @apps/mcp-core/studioCommands (no subdir)
        rules.append((
            re.compile(rf"(['\"]){d}src/cli/(studioCommands)"),
            r'\1@apps/mcp-core/\2',
        ))
        # src/cli/ -> @apps/mcp-core/commands/
        rules.append((
            re.compile(rf"(['\"]){d}src/cli/"),
            r'\1@apps/mcp-core/commands/',
        ))
        # src/commands/ -> @apps/mcp-core/commands/
        rules.append((
            re.compile(rf"(['\"]){d}src/commands/"),
            r'\1@apps/mcp-core/commands/',
        ))

        # src/agents/middleware/ -> @packages/agents/middleware/
        rules.append((
            re.compile(rf"(['\"]){d}src/agents/middleware/"),
            r'\1@packages/agents/middleware/',
        ))
        # src/agents/swarm/ -> @packages/agents/swarm/
        rules.append((
            re.compile(rf"(['\"]){d}src/agents/swarm/"),
            r'\1@packages/agents/swarm/',
        ))
        # src/agents/ -> @packages/agents/
        rules.append((
            re.compile(rf"(['\"]){d}src/agents/"),
            r'\1@packages/agents/',
        ))

        # src/core/federation/ -> @packages/core-logic/federation/
        rules.append((
            re.compile(rf"(['\"]){d}src/core/federation/"),
            r'\1@packages/core-logic/federation/',
        ))
        # src/core/swarm/ -> @packages/core-logic/swarm/
        rules.append((
            re.compile(rf"(['\"]){d}src/core/swarm/"),
            r'\1@packages/core-logic/swarm/',
        ))
        # src/core/sandbox/ -> @packages/core-logic/sandbox/
        rules.append((
            re.compile(rf"(['\"]){d}src/core/sandbox/"),
            r'\1@packages/core-logic/sandbox/',
        ))
        # src/core/ -> @packages/core-logic/
        rules.append((
            re.compile(rf"(['\"]){d}src/core/"),
            r'\1@packages/core-logic/',
        ))

        # src/dashboard/lib/ -> @/lib/
        rules.append((
            re.compile(rf"(['\"]){d}src/dashboard/lib/"),
            r'\1@/lib/',
        ))
        # src/dashboard/components/ -> @/components/
        rules.append((
            re.compile(rf"(['\"]){d}src/dashboard/components/"),
            r'\1@/components/',
        ))
        # src/dashboard/ -> @/  (catch-all for other dashboard sub-paths)
        rules.append((
            re.compile(rf"(['\"]){d}src/dashboard/"),
            r'\1@/',
        ))

        # src/security/ -> @packages/core-logic/
        rules.append((
            re.compile(rf"(['\"]){d}src/security/"),
            r'\1@packages/core-logic/',
        ))

        # src/services/ -> @packages/core-logic/
        rules.append((
            re.compile(rf"(['\"]){d}src/services/"),
            r'\1@packages/core-logic/',
        ))

        # src/mesh/ -> @packages/core-logic/
        rules.append((
            re.compile(rf"(['\"]){d}src/mesh/"),
            r'\1@packages/core-logic/',
        ))
        # src/kernel/ -> @packages/core-logic/
        rules.append((
            re.compile(rf"(['\"]){d}src/kernel/"),
            r'\1@packages/core-logic/',
        ))
        # src/infra/ -> @packages/core-logic/
        rules.append((
            re.compile(rf"(['\"]){d}src/infra/"),
            r'\1@packages/core-logic/',
        ))
        # src/orchestrator/ -> @packages/core-logic/
        rules.append((
            re.compile(rf"(['\"]){d}src/orchestrator/"),
            r'\1@packages/core-logic/',
        ))
        # src/kkv/ -> @packages/core-logic/
        rules.append((
            re.compile(rf"(['\"]){d}src/kkv/"),
            r'\1@packages/core-logic/',
        ))

        # src/utils/ -> @packages/utils/
        rules.append((
            re.compile(rf"(['\"]){d}src/utils/"),
            r'\1@packages/utils/',
        ))
        # src/tools/ -> @packages/utils/
        rules.append((
            re.compile(rf"(['\"]){d}src/tools/"),
            r'\1@packages/utils/',
        ))
        # src/config/ -> @packages/utils/
        rules.append((
            re.compile(rf"(['\"]){d}src/config/"),
            r'\1@packages/utils/',
        ))
        # src/data/ -> @packages/utils/
        rules.append((
            re.compile(rf"(['\"]){d}src/data/"),
            r'\1@packages/utils/',
        ))

        # src/types/ -> @packages/types/
        rules.append((
            re.compile(rf"(['\"]){d}src/types/"),
            r'\1@packages/types/',
        ))
        # src/schemas/ -> @packages/types/
        rules.append((
            re.compile(rf"(['\"]){d}src/schemas/"),
            r'\1@packages/types/',
        ))
        # src/database/ -> @packages/database/
        rules.append((
            re.compile(rf"(['\"]){d}src/database/"),
            r'\1@packages/database/',
        ))

        # src/metrics (no trailing slash - bare module) -> @packages/utils/metrics
        rules.append((
            re.compile(rf"(['\"]){d}src/metrics(['\"])"),
            r'\1@packages/utils/metrics\2',
        ))

    # -----------------------------------------------------------------------
    # Post-correction: move services-subdir files from top-level to services/
    # These were incorrectly mapped to @packages/core-logic/<X>.js above
    # -----------------------------------------------------------------------
    rules.append((
        re.compile(
            rf"(['\"])@packages/core-logic/({SERVICES_SUBDIR_PATTERN})(\.js)?(['\"])"
        ),
        r'\1@packages/core-logic/services/\2\3\4',
    ))

    # Fix any @packages/security/ aliases that slipped through
    rules.append((
        re.compile(r"(['\"])@packages/security/"),
        r'\1@packages/core-logic/',
    ))

    return rules


def process_files(roots, rules):
    files_changed = 0
    pattern_hit_counts = defaultdict(int)

    for root in roots:
        for dirpath, dirs, filenames in os.walk(root):
            # Skip node_modules
            dirs[:] = [d for d in dirs if d != 'node_modules']
            for fn in filenames:
                if not fn.endswith(('.ts', '.tsx', '.js')):
                    continue
                fp = os.path.join(dirpath, fn)
                try:
                    with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                except OSError:
                    continue

                new_content = content
                for pat, rep in rules:
                    result = pat.sub(rep, new_content)
                    if result != new_content:
                        pattern_hit_counts[pat.pattern] += 1
                    new_content = result

                if new_content != content:
                    with open(fp, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    rel = fp.replace(REPO_ROOT + os.sep, '')
                    print(f'  Fixed: {rel}')
                    files_changed += 1

    return files_changed, pattern_hit_counts


def verify_remaining(roots):
    """Scan for any remaining ../src/ or ../../src/ patterns."""
    remaining = []
    for root in roots:
        for dirpath, dirs, filenames in os.walk(root):
            dirs[:] = [d for d in dirs if d != 'node_modules']
            for fn in filenames:
                if not fn.endswith(('.ts', '.tsx', '.js')):
                    continue
                fp = os.path.join(dirpath, fn)
                try:
                    with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                        lines = f.readlines()
                except OSError:
                    continue
                for i, line in enumerate(lines, 1):
                    if re.search(r'''['"](\.\.\/)+src/''', line):
                        rel = fp.replace(REPO_ROOT + os.sep, '')
                        remaining.append(f'  {rel}:{i}: {line.rstrip()}')
    return remaining


if __name__ == '__main__':
    print('=' * 70)
    print('fix_test_imports_pass7.py — Fixing remaining broken src/ imports')
    print('=' * 70)

    rules = build_patterns()
    print(f'Built {len(rules)} replacement rules.\n')

    changed, hit_counts = process_files([TESTS_ROOT], rules)

    print(f'\nSummary: {changed} files updated.')

    if hit_counts:
        print('\nPattern hit counts (patterns that matched at least once):')
        for pat, count in sorted(hit_counts.items(), key=lambda x: -x[1]):
            print(f'  [{count:3d}x] {pat}')

    print('\nChecking for remaining broken imports...')
    remaining = verify_remaining([TESTS_ROOT])
    if remaining:
        print(f'WARNING: {len(remaining)} lines still have ../src/ patterns:')
        for line in remaining[:30]:
            print(line)
        if len(remaining) > 30:
            print(f'  ... and {len(remaining) - 30} more')
    else:
        print('  All clear — no remaining ../src/ patterns found!')

    print('\nDone.')
