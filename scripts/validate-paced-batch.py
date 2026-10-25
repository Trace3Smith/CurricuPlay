"""Validate teacher-approved paced batches. Read-only; exits non-zero on any error.

Checks every Jeopardy and Four Corners question in src/data/paced-*.json and every Spelling Bee entry
built from a paced batch:
  - the item was approved by the teacher in content/paced/<batch>/approvals.json (removed/held items absent)
  - the evidence quote appears verbatim (whitespace-normalised) in a checked-in snapshot of the cited document
  - taught dates fall inside the aligned week; week-only items unlock on Friday (rolling-month rule handles review)
  - ids and prompts are unique across the existing banks; Four Corners has four distinct choices and one answer
  - prompts are short enough for a shared screen; no Math in Four Corners
"""
import datetime, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
read = lambda p: json.loads((ROOT / p).read_text())
errors = []
def check(ok, msg):
    if not ok: errors.append(msg)
norm = lambda s: re.sub(r'\s+', ' ', s.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"').replace('–', '-').replace('—', '-')).strip()
key = lambda s: re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()

batches = {p.name: read(f'content/paced/{p.name}/approvals.json') for p in sorted((ROOT / 'content/paced').iterdir()) if p.is_dir()}
approved = {(b, i) for b, a in batches.items() for i, d in a['decisions'].items() if d == 'approve' and i not in a.get('held', {})}
jeopardy, corners = read('src/data/paced-jeopardy.json'), read('src/data/paced-four-corners.json')
base_j, base_fc = read('src/data/tomorrow-pack.json'), read('src/data/four-corners.json')
sb = read('src/data/spelling-bee-pacing.json')
evidence = {e['id']: e for e in read('content/spelling-bee/evidence.json')}

def batch_of(q):
    return q['packId'].replace('classthread-paced-', '')

def quote_ok(document, url, quote):
    path = ROOT / 'content/sources' / document
    if not path.is_file(): return False
    snap = json.loads(path.read_text())
    return snap.get('url') == url and norm(quote) in norm(snap['content'])

def monday(d):
    d = datetime.date.fromisoformat(d); return (d - datetime.timedelta(days=d.weekday())).isoformat()

for name, coll, base in (('jeopardy', jeopardy, base_j), ('four-corners', corners, base_fc)):
    base_ids = {q['id'] for q in base}; base_prompts = {key(q['question']) for q in base}
    seen_ids, seen_prompts = set(), set()
    for q in coll:
        p = f"{name} {q['id']}: "
        check(q['id'] not in base_ids and q['id'] not in seen_ids, p + 'duplicate id'); seen_ids.add(q['id'])
        check(key(q['question']) not in base_prompts and key(q['question']) not in seen_prompts, p + 'duplicate prompt'); seen_prompts.add(key(q['question']))
        check((batch_of(q), q['batchItemId']) in approved, p + 'not approved by the teacher')
        check(q['reviewStatus'] == 'approved' and q['approvalBasis'] == 'teacher-review' and q['requiresExternalClassroomMaterial'] is False, p + 'approval fields')
        check(quote_ok(q['evidence']['document'], q['sourceUrl'], q['evidence']['quote']), p + 'evidence quote not in local snapshot')
        week = q['weekIntroduced']
        check(monday(week) == week and q['alignedWeeks'] == [week], p + 'week must be a Monday and the only aligned week')
        if 'taughtOn' in q:
            check(week <= q['taughtOn'] <= (datetime.date.fromisoformat(week) + datetime.timedelta(days=4)).isoformat(), p + 'taughtOn outside its week')
        check(len(q['question']) <= 240, p + 'prompt too long')
        if name == 'four-corners':
            check(q['subject'] != 'Math', p + 'Math in Four Corners')
            check(len(q['choices']) == 4 and len({key(c) for c in q['choices']}) == 4, p + 'four distinct choices')
            check(q['choices'][q['correctIndex']] == q['answer'] and q['choices'].count(q['answer']) == 1, p + 'answer mapping')
            check(max(map(len, q['choices'])) <= 95, p + 'choice too long')

for w in sb:
    if not w['evidenceId'].startswith('paced-'): continue
    p = f"spelling-bee {w['id']}: "; b = w['evidenceId'].split('-')[1] + '-' + w['evidenceId'].split('-')[2]
    item = w['evidenceId'].split(f'paced-{b}-', 1)[1]
    check((b, item) in approved, p + 'not approved by the teacher')
    e = evidence.get(w['evidenceId']); check(e is not None, p + 'missing evidence record')
    if e:
        snap = read(e['snapshot']); check(snap['url'] == w['curriculum']['sourceUrl'], p + 'source URL mismatch')
        check(w['curriculum']['earliestEligible'] == w['curriculum']['periods'][0]['end'], p + 'must unlock at period end')

counts = {b: dict(approved=sum(1 for x in approved if x[0] == b),
                  jeopardy=sum(batch_of(q) == b for q in jeopardy), fourCorners=sum(batch_of(q) == b for q in corners),
                  spellingBee=sum(w['evidenceId'].startswith(f'paced-{b}-') for w in sb)) for b in batches}
print(json.dumps(dict(batches=counts, errors=errors), indent=1, ensure_ascii=False))
raise SystemExit(bool(errors))
