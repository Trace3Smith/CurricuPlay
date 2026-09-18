"""Read-only citation-coverage inventory across every playable bank.

Emits content/reports/CITATION_COVERAGE.json and .md. Never reads or writes question
content, never edits a bank, and never fails a build: it reports what is asserted and
what is corroborated by the pacing workbook, so the unverified count is visible on
every run instead of living in a report body. Enforcement stays in the validators.
"""
import collections
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
read = lambda path: json.loads((root / path).read_text())
CUTOFF = '2026-09-13'
# Session labels differ only by dash style between the workbook and the authored banks.
dashes = lambda text: re.sub(r'[–—-]', '-', text or '')

curriculum = {c['id']: c for c in read('src/data/curriculum.json')}
BANKS = [
    ('four-corners', 'src/data/four-corners.json', 'Four Corners runtime'),
    ('tomorrow-pack', 'src/data/tomorrow-pack.json', 'Jeopardy classroom bank'),
    ('questions', 'src/data/questions.json', 'Draft bank: Jeopardy drafts source and Review UI'),
]

def classify(q):
    """Return (bucket, detail) for one question's standard-code provenance."""
    row = curriculum.get(q.get('curriculumId'))
    if row is None:
        return 'noPacingRow', None
    standard = q.get('standard')
    if standard is None:
        session = q.get('session')
        if not session:
            return 'nullWithNoSession', None
        if any(dashes(session) == dashes(s) for s in row['sessionReferences']):
            return 'nullWithSessionInPacingRow', session
        return 'nullWithSessionNotInPacingRow', session
    if standard in row['standardReferences']:
        return 'codeInPacingRow', standard
    quote = (q.get('evidence') or {}).get('quote', '')
    if standard in quote:
        return 'codeInLinkedSourceOnly', '%s via %s' % (standard, q['evidence']['document'])
    return 'codeUncorroborated', standard

ORDER = ['codeInPacingRow', 'codeInLinkedSourceOnly', 'codeUncorroborated',
         'nullWithSessionInPacingRow', 'nullWithSessionNotInPacingRow', 'nullWithNoSession', 'noPacingRow']
VERIFIED = {'codeInPacingRow'}

report = {
    'generated': CUTOFF, 'cutoff': CUTOFF,
    'whatThisIs': 'Inventory only. The pacing citation (curriculumId, weekIntroduced, evidence quote) is '
                  'enforced by the validators. The standard code is optional everywhere and is compared '
                  'against the pacing workbook here for visibility, not enforcement.',
    'buckets': {
        'codeInPacingRow': 'Standard code appears literally in its pacing-guide row. Verified.',
        'codeInLinkedSourceOnly': 'Standard code is absent from the pacing row but appears in the cited linked document.',
        'codeUncorroborated': 'Standard code appears in neither the pacing row nor the evidence quote.',
        'nullWithSessionInPacingRow': 'No standard code; session label matches the pacing row. Timing corroborated, alignment unasserted.',
        'nullWithSessionNotInPacingRow': 'No standard code; the session field holds text that is in no pacing row.',
        'nullWithNoSession': 'No standard code and no session. Rejected at runtime by validateQuestions.',
        'noPacingRow': 'curriculumId does not resolve to a curriculum row.',
    },
    'banks': {}, 'crossBankStandardDisagreements': [], 'systemicNotes': [],
}

placement = {}
for key, path, consumer in BANKS:
    bank = read(path)
    buckets = collections.defaultdict(list)
    missing_pacing = []
    for q in bank:
        if not q.get('curriculumId') or not (q.get('evidence') or {}).get('quote'):
            missing_pacing.append(q['id'])
        bucket, detail = classify(q)
        buckets[bucket].append(q['id'])
        placement.setdefault(q['id'], {})
        placement[q['id']] = {'standard': q.get('standard'), 'bucket': bucket, 'bank': key,
                              'originId': q.get('originId'), 'detail': detail}
    verified = sum(len(buckets[b]) for b in VERIFIED)
    report['banks'][key] = {
        'file': path, 'consumedBy': consumer, 'total': len(bank),
        'pacingCitation': {'complete': len(bank) - len(missing_pacing), 'missing': missing_pacing},
        'standardCode': {
            'verified': verified, 'unverified': len(bank) - verified,
            'byBucket': {b: {'count': len(buckets[b]), 'items': sorted(buckets[b])} for b in ORDER if buckets[b]},
            'unverifiedByGradeSubject': dict(collections.Counter(
                '%s %s' % (q['grade'], q['subject']) for q in bank if classify(q)[0] not in VERIFIED)),
        },
    }

# Same underlying item, different standard assertion between banks.
# Several items in one bank can share a single anchor, so collect every one of them.
by_origin = collections.defaultdict(lambda: collections.defaultdict(list))
for key, path, _ in BANKS:
    for q in read(path):
        by_origin[q.get('originId') or q['id']][key].append(q)
for anchor, rows in sorted(by_origin.items()):
    if len(rows) < 2:
        continue
    asserted = {k: sorted({str(q.get('standard')) for q in qs}) for k, qs in rows.items()}
    if len({c for values in asserted.values() for c in values}) < 2:
        continue
    # A derived item may legitimately be remapped to a different week, and then carries that
    # row's code. Only report when one side is actually unverified against the workbook.
    unverified = {k: sorted(q['id'] for q in qs if classify(q)[0] not in VERIFIED) for k, qs in rows.items()}
    if not any(unverified.values()):
        continue
    report['crossBankStandardDisagreements'].append({
        'anchor': anchor, 'byBank': asserted,
        'unverifiedItems': {k: v for k, v in unverified.items() if v},
        'affected': sum(len(v) for v in unverified.values()),
        'note': 'One bank withholds or cannot corroborate a code the other asserts. Review both before trusting either.'})

literacy_rows = [c for c in curriculum.values() if c['subject'] == 'Literacy']
report['systemicNotes'] = [
    'No standard-code check runs against src/data/four-corners.json. scripts/validate-four-corners.py '
    'verifies the pacing row and the evidence quote but never reads the standard field.',
    'scripts/build-tomorrow-pack.py line 25 is the only standard-vs-pacing check in the repository, '
    'and it covers the Jeopardy pack only.',
    '%d of %d Literacy pacing rows carry any standard code. The FY27 workbook records Literacy as '
    'program and session references (Heggerty week N, U1: Sessions 3-7), not codes, in every tab. '
    'Literacy items are therefore anchored by session, and a code cannot be recovered from this source.'
    % (sum(1 for c in literacy_rows if c['standardReferences']), len(literacy_rows)),
    'A null standard passes the runtime guard in src/services/questionEngine.ts whenever any non-empty '
    'session string is present. That is a presence check, not a curriculum check.',
]

totals = collections.Counter()
for data in report['banks'].values():
    for bucket, info in data['standardCode']['byBucket'].items():
        totals[bucket] += info['count']
report['totals'] = {'items': sum(d['total'] for d in report['banks'].values()),
                    'pacingCitationMissing': sum(len(d['pacingCitation']['missing']) for d in report['banks'].values()),
                    'standardVerified': sum(d['standardCode']['verified'] for d in report['banks'].values()),
                    'standardUnverified': sum(d['standardCode']['unverified'] for d in report['banks'].values()),
                    'byBucket': {b: totals[b] for b in ORDER if totals[b]}}

(root / 'content/reports/CITATION_COVERAGE.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')

lines = ['# Citation coverage — generated, do not edit by hand', '',
         'Produced by `scripts/report-citations.py`. ' + report['whatThisIs'], '',
         '| Bank | Items | Pacing citation missing | Standard verified | Standard unverified |', '|---|---:|---:|---:|---:|']
for key, data in report['banks'].items():
    lines.append('| `%s` — %s | %d | %d | %d | **%d** |' % (key, data['consumedBy'], data['total'],
                 len(data['pacingCitation']['missing']), data['standardCode']['verified'], data['standardCode']['unverified']))
t = report['totals']
lines += ['| **All banks** | **%d** | **%d** | **%d** | **%d** |' % (t['items'], t['pacingCitationMissing'], t['standardVerified'], t['standardUnverified']), '',
          '## Standard-code provenance', '', '| Bucket | Items | Meaning |', '|---|---:|---|']
for bucket, count in t['byBucket'].items():
    lines.append('| `%s` | %d | %s |' % (bucket, count, report['buckets'][bucket]))
lines += ['', '## Cross-bank disagreements', '',
          'One bank withholds or cannot corroborate a code another bank asserts for the same source item. '
          'A derived item remapped to a different week legitimately carries that row\u2019s code and is not listed. '
          '%d anchors, %d unverified questions:' % (len(report['crossBankStandardDisagreements']),
                                                    sum(r['affected'] for r in report['crossBankStandardDisagreements'])), '']
for row in report['crossBankStandardDisagreements']:
    lines.append('- `%s` — %s' % (row['anchor'], ', '.join('%s: %s' % (k, v) for k, v in row['byBank'].items())))
lines += ['', '## Systemic notes', ''] + ['- ' + n for n in report['systemicNotes']]
lines += ['', '## Per-bank item lists', '']
for key, data in report['banks'].items():
    lines += ['### `%s`' % key, '']
    for bucket, info in data['standardCode']['byBucket'].items():
        if bucket in VERIFIED:
            lines += ['- **%s** — %d items (verified; not listed)' % (bucket, info['count']), '']
            continue
        lines += ['- **%s** — %d items' % (bucket, info['count']), '', '  ' + ', '.join('`%s`' % i for i in info['items']), '']
(root / 'content/reports/CITATION_COVERAGE.md').write_text('\n'.join(lines) + '\n')
print(json.dumps({'totals': report['totals'],
                  'crossBankStandardDisagreements': len(report['crossBankStandardDisagreements'])}, indent=2))
