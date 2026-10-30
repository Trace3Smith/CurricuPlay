"""Build a teacher-approved paced content batch for all three games.

Inputs (all checked in):
  content/paced/<batch>/review.json     approved draft items exactly as the teacher reviewed them
  content/paced/<batch>/approvals.json  the teacher's approve/remove decisions and notes
  content/sources/...                   source snapshots each quote must appear in

Outputs:
  src/data/paced-jeopardy.json          Jeopardy questions (merged into the classroom pack at runtime)
  src/data/paced-four-corners.json      Four Corners questions (standalone, no Jeopardy parent)
  src/data/spelling-bee-pacing.json     new Spelling Bee entries appended; existing entries kept
  content/spelling-bee/evidence.json    one evidence record per new Spelling Bee entry

Run: python3 scripts/build-paced-batch.py 2026-10
Only approved items are written. Removed items never reach the games.
"""
import datetime, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BATCH = sys.argv[1] if len(sys.argv) > 1 else '2026-10'
DIR = ROOT / 'content' / 'paced' / BATCH
PACK_ID = f'classthread-paced-{BATCH}'
PACK_NAME = f'ClassThread paced content ({BATCH})'
read = lambda p: json.loads(Path(p).read_text())
write = lambda p, d, indent=1: Path(p).write_text(json.dumps(d, indent=indent, ensure_ascii=False) + '\n')

review = read(DIR / 'review.json')
approvals = read(DIR / 'approvals.json')['decisions']
edits = read(DIR / 'approvals.json').get('edits', {})
holds = read(DIR / 'approvals.json').get('held', {})

def norm(s):
    return re.sub(r'\s+', ' ', s.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"').replace('–', '-').replace('—', '-')).strip()

snapshots = {}
for f in sorted((ROOT / 'content' / 'sources').rglob('*.json')):
    try:
        d = read(f)
    except Exception:
        continue
    if isinstance(d, dict) and isinstance(d.get('content'), str) and d.get('url'):
        snapshots[str(f.relative_to(ROOT))] = d

def doc_id(url):
    m = re.search(r'/d/([\w-]+)', url or '')
    return m.group(1) if m else url

def find_snapshot(ev):
    """The snapshot of the cited document that contains the quote verbatim (whitespace-normalised)."""
    want = doc_id(ev['sourceUrl']); q = norm(ev['quote'])
    for path, d in snapshots.items():
        if doc_id(d['url']) == want and q in norm(d['content']):
            return path, d
    raise SystemExit(f"quote not found in any snapshot of {ev['sourceTitle']}: {ev['quote'][:80]}")

def friday(week):
    d = datetime.date.fromisoformat(week)
    return (d + datetime.timedelta(days=4 - d.weekday())).isoformat()

pictures = read(ROOT / 'src/data/spelling-bee-pictures.json')

def listed_in_week(snap, week, word):
    """Same rule as validate-spelling-bee-pacing.py: the term must appear in the snapshot's dated weekly section."""
    start = datetime.date.fromisoformat(week); text = snap['content'].replace('\r', '')
    pattern = rf'{start.strftime("%b")}\s+{start.day}\s*[–-]'
    match = next((m for m in re.finditer(pattern, text) if m.start() > text.find('📅') - 5), None)
    if not match: return False
    end = text.find('📅', match.end()); block = text[match.start():end if end >= 0 else None]
    return bool(re.search(r'\b' + word + r'\b', block, re.I))

def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')[:40]

jeopardy, corners, sb_new, sb_evidence, sb_updates = [], [], [], [], {}
sb_bank = read(ROOT / 'src/data/spelling-bee-pacing.json')
own = lambda w: w.get('source', '').endswith(f'paced batch {BATCH}')  # entries created by an earlier run of this batch
sb_ids = {w['id'] for w in sb_bank if not own(w)}; sb_words = {(w['grade'], w['word']): w for w in sb_bank if not own(w)}
skipped = []

for r in review:
    rid = r['id']; decision = approvals.get(rid)
    if decision != 'approve':
        skipped.append((rid, decision or 'unmarked')); continue
    if rid in holds:
        skipped.append((rid, 'held: ' + holds[rid])); continue
    it = json.loads(json.dumps(r['item']))
    for field, value in edits.get(rid, {}).items():
        it[field] = value
    g, game, week = r['grade'], r['game'], it['weekOf']
    ev = it['evidence']; snap_path, snap = find_snapshot(ev)
    evidence = {'document': snap_path.replace('content/sources/', ''), 'sourceUrl': snap['url'], 'sourceTitle': ev['sourceTitle'],
                'section': ev['locator'], 'quote': ev['quote']}
    plan = r.get('planEvidence') or (r['item'].get('planCheck') or {}).get('evidence')
    common = dict(grade=g, weekIntroduced=week, alignedWeeks=[week], source=PACK_NAME, packId=PACK_ID, packName=PACK_NAME,
                  sourceUrl=snap['url'], evidence=evidence, reviewStatus='approved', approvalBasis='teacher-review',
                  reviewNote=f'Approved by the teacher on the {BATCH} review page (item {rid}).', requiresExternalClassroomMaterial=False,
                  materialReviewNote='Self-contained classroom question.', reviewQuestion=False, batchItemId=rid)
    if it.get('taughtOn'):
        common['taughtOn'] = it['taughtOn']
    if plan and plan is not ev:
        common['lessonPlanCheck'] = {'sourceTitle': plan.get('sourceTitle'), 'section': plan.get('locator'), 'quote': plan.get('quote')}
    if game == 'jeopardy':
        jeopardy.append(dict(id=f'paced-{BATCH}-{g}-{slug(it["question"])}', subject=it['subject'], difficulty=it.get('difficulty', 1),
            question=it['question'], answer=it['answer'], standard=it.get('standard') or None, session=None if it.get('standard') else ev['locator'],
            questionType='short-answer', teacherRead=bool(it.get('teacherRead', False)), **common))
    elif game == 'fourCorners':
        choices = it['choices']; answer = choices[it['correctIndex']]
        corners.append(dict(id=f'fc-paced-{BATCH}-{g}-{slug(it["question"])}', subject=it['subject'], difficulty=it.get('difficulty', 1),
            question=it['question'], answer=answer, choices=choices, correctIndex=it['correctIndex'], explanation=it.get('explanation', ''),
            standard=it.get('standard') or None, session=None if it.get('standard') else ev['locator'],
            questionType='four-corners', teacherRead=True, **common))
    else:
        word = it['word']; taught = it.get('taughtOn')
        period = {'start': taught, 'end': taught} if taught else {'start': week, 'end': friday(week)}
        subject = r['subject'] if r['subject'] in ('Science', 'Social Studies', 'Math') else 'Literacy'
        initial = g == 'K'
        category = it.get('category') if it.get('category') in ('source-listed', 'skill-practice') else 'skill-practice'
        if category == 'source-listed' and not listed_in_week(snap, period['start'], word):
            category = 'skill-practice'  # the word is taught that week but not printed in the dated section of the snapshot
        curriculum = dict(grade=g, subject=subject, target=it.get('skill') or subject, source=ev['sourceTitle'], sourceUrl=snap['url'],
            locator=ev['locator'], unit=ev['locator'][:120], earliestEligible=period['end'], periods=[period],
            category=category, timing='documented', review='approved',
            note=f'Teacher-approved {BATCH} batch item {rid}. ' + ('Object names are ClassThread practice; child supplies only the first letter.' if initial else 'Original ClassThread clue.'))
        existing = sb_words.get((g, word))
        if existing:
            if existing['curriculum']['timing'] == 'documented' and not existing['evidenceId'].startswith(f'paced-{BATCH}-'):
                skipped.append((rid, f'already in bank as {existing["id"]}')); continue
            evid = f'paced-{BATCH}-{rid}'  # resolves a previously held date conflict
            sb_updates[existing['id']] = (curriculum, evid)
            sb_evidence.append(dict(id=evid, snapshot=snap_path, **curriculum))
            continue
        entry = dict(id=f'pacing-{g}-{word}', grade=g, word=word,
            clue='What letter does this object start with?' if initial else it['clue'], skill=it.get('skill') or subject,
            picture=(it.get('picture') or word) if initial else None, source=f'DCSS FY27 {subject}: teacher-approved paced batch {BATCH}',
            kind='curriculum', reviewStatus='approved', curriculum=curriculum, evidenceId=f'paced-{BATCH}-{rid}',
            complexity='foundation' if g in ('K', '1') else 'academic')
        if initial:
            entry['activity'] = 'initial'
        assert entry['id'] not in sb_ids, entry['id']
        sb_ids.add(entry['id']); sb_new.append(entry)
        sb_evidence.append(dict(id=entry['evidenceId'], snapshot=snap_path, **curriculum))

for coll in (jeopardy, corners):
    ids = [q['id'] for q in coll]
    assert len(ids) == len(set(ids)), 'duplicate generated id'

# Spelling Bee: keep existing entries; resolve updated ones; append new.
evidence_path = ROOT / 'content/spelling-bee/evidence.json'
evidence_all = [e for e in read(evidence_path) if not e['id'].startswith(f'paced-{BATCH}-')]
by_id = {e['id']: e for e in evidence_all}
out_bank = []
for w in sb_bank:
    if own(w):
        continue  # rebuilt below
    if w['id'] in sb_updates:
        w = dict(w); w['curriculum'], w['evidenceId'] = sb_updates[w['id']]
    out_bank.append(w)
for e in sb_evidence:
    if e['id'] in by_id:
        by_id[e['id']].update(e)
    else:
        evidence_all.append(e); by_id[e['id']] = e
write(ROOT / 'src/data/spelling-bee-pacing.json', out_bank + sb_new, 2)
write(evidence_path, evidence_all, 2)
# Keep other batches' questions; replace only this batch's.
others = lambda path: [q for q in read(path) if q.get('packId') != PACK_ID] if path.exists() else []
write(ROOT / 'src/data/paced-jeopardy.json', others(ROOT / 'src/data/paced-jeopardy.json') + jeopardy)
write(ROOT / 'src/data/paced-four-corners.json', others(ROOT / 'src/data/paced-four-corners.json') + corners)
report = dict(batch=BATCH, jeopardy=len(jeopardy), fourCorners=len(corners), spellingBeeNew=len(sb_new), spellingBeeResolved=sorted(sb_updates),
              skipped=[dict(id=i, reason=why) for i, why in skipped])
write(DIR / 'build-report.json', report)
print(json.dumps({k: v for k, v in report.items() if k != 'skipped'}, indent=1)); print('skipped', len(skipped))
for s in skipped: print('  ', *s)
