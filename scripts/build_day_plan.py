from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

ROOT = Path('/Users/pulkit/Downloads/Stellar')
SRC = ROOT / 'Planner/Core/DAY_WISE_INDEX_STARTING_2026-04-04.md'
OUT = ROOT / 'ems-portal/data/day-plan.json'


def parse_file_refs(text: str) -> list[str]:
    refs = []
    # markdown links
    for m in re.finditer(r'\[([^\]]+\.(?:mp4|pdf|md))\]\(<[^>]+>\)', text, flags=re.I):
        refs.append(m.group(1).strip())
    # backticks fallback
    for m in re.finditer(r'`([^`]+\.(?:mp4|pdf|md))`', text, flags=re.I):
        val = m.group(1).strip()
        if val not in refs:
            refs.append(val)
    return refs


lines = SRC.read_text(encoding='utf-8').splitlines()

# Parse custom updated focus block for Apr 4
focus_tasks = []
focus_mode = False
for i, line in enumerate(lines):
    if line.strip() == '## April 4, 2026 (Updated Focus Plan)':
        focus_mode = True
        continue
    if focus_mode and line.startswith('## Week 1'):
        break
    if focus_mode:
        m_task = re.match(r'^- \[ \] (.+)$', line.strip())
        if m_task:
            task = {'title': m_task.group(1).strip(), 'files': []}
            # gather the following indented file lines
            j = i + 1
            while j < len(lines) and lines[j].startswith('  - '):
                task['files'].extend(parse_file_refs(lines[j]))
                j += 1
            focus_tasks.append(task)


items = []
current = None

for line in lines:
    line = line.rstrip('\n')
    m_day = re.match(r'^- \*\*(\d{4}-\d{2}-\d{2}) \(([^)]+)\)\*\*$', line)
    if m_day:
        if current:
            items.append(current)
        current = {
            'date': m_day.group(1),
            'weekday': m_day.group(2),
            'core': '',
            'files': [],
            'test_number': None,
            'test_files': [],
            'notes': [],
        }
        continue

    if not current:
        continue

    stripped = line.strip()
    if stripped.startswith('- Core: '):
        current['core'] = stripped.replace('- Core: ', '', 1).strip()
    elif stripped.startswith('- Files: '):
        current['files'].extend(parse_file_refs(stripped))
    elif stripped.startswith('- Weekend Heavy: PT'):
        m = re.search(r'PT(\d{2})', stripped)
        if m:
            current['test_number'] = int(m.group(1))
        current['notes'].append(stripped.replace('- ', '', 1))
    elif stripped.startswith('- Test Files: '):
        current['test_files'].extend(parse_file_refs(stripped))
    elif stripped.startswith('- Daily Reinforcement: ') or stripped.startswith('- Light Friday Close: ') or stripped.startswith('- Extra Load: '):
        current['notes'].append(stripped.replace('- ', '', 1))

if current:
    items.append(current)

# attach focus block to apr-4 item if present
for item in items:
    if item['date'] == '2026-04-04':
        item['focus_plan'] = focus_tasks
        break

payload = {
    'generated_at': datetime.utcnow().isoformat() + 'Z',
    'start_date': '2026-04-04',
    'days': items,
}

OUT.write_text(json.dumps(payload, indent=2), encoding='utf-8')
print(f'Wrote {OUT} ({len(items)} day rows)')
