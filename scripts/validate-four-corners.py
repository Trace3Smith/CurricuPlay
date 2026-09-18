"""Read-only content validation; emits the expansion audit, never edits questions."""
import collections
import difflib
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
read = lambda path: json.loads((root / path).read_text())
questions = read('src/data/four-corners.json')
baseline = read('content/four-corners/mvp-baseline.json')
parents = {q['id']: q for q in read('src/data/tomorrow-pack.json')}
drafts = {q['id']: q for q in read('src/data/questions.json')}
curriculum = {c['id']: c for c in read('src/data/curriculum.json')}
errors = []
check = lambda condition, message: errors.append(message) if not condition else None
normalize = lambda text: re.sub(r'[^a-z0-9]+', ' ', text.lower()).strip()
check(len({q['id'] for q in questions}) == len(questions), 'Duplicate question IDs')
audit = read('content/four-corners/quality-audit.json')['records']
pre_audit = read('content/four-corners/pre-quality-audit.json')
check([r['before'] for r in audit] == pre_audit, 'Quality-audit baseline mismatch')
check([r['after'] for r in audit if r['after'] is not None] == questions, 'Unreviewed runtime bank change')
check(all(r['before'] == r['after'] for r in audit if r['disposition'] == 'preserved'), 'Preserved item changed')
seen = set()
choice_sets = collections.defaultdict(list)
for q in questions:
    prefix = q['id'] + ': '
    check(normalize(q['question']) not in seen, prefix + 'exact duplicate prompt')
    seen.add(normalize(q['question']))
    check(len(q['choices']) == 4 and len({normalize(c) for c in q['choices']}) == 4, prefix + 'choices must be four distinct options')
    check(q['choices'].count(q['answer']) == 1 and q['choices'][q['correctIndex']] == q['answer'], prefix + 'answer mapping is not unique')
    check(q['subject'] in ['Science', 'Social Studies', 'Literacy'], prefix + 'unexpected subject')
    check(q['requiresExternalClassroomMaterial'] is False, prefix + 'external materials')
    check(q['weekIntroduced'] <= '2026-09-13' and all(w <= '2026-09-13' for w in q['alignedWeeks']), prefix + 'future curriculum')
    c = curriculum[q['curriculumId']]
    check(c['grade'] == q['grade'] and c['subject'] == q['subject'] and c['weekOf'] == q['weekIntroduced'], prefix + 'pacing mismatch')
    check(q['originId'] in parents, prefix + 'missing source anchor')
    if q.get('adaptation', {}).get('kind') == 'conversion':
        source = {**parents, **drafts}.get(q['adaptation']['sourceQuestionId'])
        check(source is not None and source['grade'] == q['grade'] and source['subject'] == q['subject'], prefix + 'invalid conversion source')
    e = q['evidence']; document = read('content/sources/' + e['document'])
    check(e['quote'] in document['content'], prefix + 'evidence quote not in local source')
    check(len(q['question']) <= 240 and max(map(len, q['choices'])) <= 95, prefix + 'excessive length')
    check(not re.search(r'\b(teacher checks|worksheet|word wall|textbook|nuclear fusion|cleavage|streak test)\b', q['question'] + ' ' + ' '.join(q['choices']), re.I), prefix + 'material/teacher-facing/advanced wording')
    if q.get('visual'):
        v = q['visual']; check(v['src'].startswith('/four-corners/') and (root / ('public' + v['src'])).is_file() and len(v['alt']) > 15, prefix + 'invalid local visual or alt')
    choice_sets[tuple(sorted(normalize(c) for c in q['choices']))].append(q['id'])
near = []
for i, q in enumerate(questions):
    for other in questions[i + 1:]:
        if (q['grade'], q['subject']) != (other['grade'], other['subject']): continue
        score = difflib.SequenceMatcher(None, normalize(q['question']), normalize(other['question'])).ratio()
        if score >= .72:
            near.append({'ids': [q['id'], other['id']], 'similarity': round(score, 3), 'questions': [q['question'], other['question']]})
baseline_ids = {q['id'] for q in baseline}
new = [q for q in questions if q['id'] not in baseline_ids]
positions = [q['correctIndex'] for q in new]
longest = max((sum(1 for _ in group) for _, group in __import__('itertools').groupby(positions)), default=0)
report = {
    'cutoff': '2026-09-13', 'total': len(questions), 'new': len(new),
    'newConversions': sum(q.get('adaptation', {}).get('kind') == 'conversion' for q in new),
    'newSourceExercises': sum(q.get('adaptation', {}).get('kind') == 'source-exercise' for q in new),
    'visuals': sum('visual' in q for q in questions), 'originalItemsUnchanged': questions[:len(baseline)] == baseline,
    'qualityAudit': dict(collections.Counter(r['disposition'] for r in audit)),
    'qualityAuditOriginalDispositions': dict(collections.Counter(r.get('qualityDisposition', r['disposition']) for r in audit)),
    'itemsWithExplanation': sum(bool(q.get('explanation')) for q in questions),
    'unreviewedChanges': 0 if [r['after'] for r in audit if r['after'] is not None] == questions else 1,
    'answerPositions': dict(collections.Counter('ABCD'[q['correctIndex']] for q in questions)),
    'newAnswerPositionLongestRun': longest,
    'newPositionCycleMatchFraction': round(sum(p == positions[i-4] for i,p in enumerate(positions) if i >= 4) / (len(positions)-4), 3),
    'grades': [{'grade': g, 'subjects': dict(collections.Counter(q['subject'] for q in questions if q['grade'] == g)), 'total': sum(q['grade'] == g for q in questions)} for g in ['K','1','2','3','4','5']],
    'nearDuplicateCandidates': near,
    'repeatedChoiceSets': [ids for ids in choice_sets.values() if len(ids) > 1],
    'editorialReview': 'See FOUR_CORNERS_QUALITY_AUDIT.md for semantic, one-answer, age, source-scope and distractor review. Similarity candidates are not automatically treated as duplicates.',
    'errors': errors,
}
(root / 'content/reports/FOUR_CORNERS_EXPANSION_VALIDATION.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['nearDuplicateCandidates','repeatedChoiceSets','editorialReview']}, indent=2))
raise SystemExit(bool(errors))
