"""Deterministic release gate for the separately authored Tomorrow Pack. No live AI.
Editorial candidate decisions are inputs; mechanical checks cannot certify teaching quality.
"""
import json,re,hashlib,sys
from pathlib import Path
from collections import Counter
from difflib import SequenceMatcher
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def write(p,v):(ROOT/p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
CUTOFF='2026-09-13'; PACK='DCSS Tomorrow Classroom Pack - 2026-09-14'
cs=read('content/tomorrow/candidates.json');curr={r['id']:r for r in read('src/data/curriculum.json')};errors=[]
retained=[c for c in cs if c['decision']=='retained'];ids=set();norms=set();near=[]
# Template variants share their parent's family: one tile at most, and no duplicate comparisons among them.
def family(q):return q.get('templateParentId') or q['id']
def check(ok,msg):
 if not ok:errors.append(msg)
for c in cs:
 check(c['id'] not in ids,'Duplicate candidate ID '+c['id']);ids.add(c['id'])
 check(c['decision'] in ['retained','rejected'] and bool(c['selectionReason']),c['id']+': missing decision')
 if c['decision']!='retained':continue
 ident=c['id'];r=curr.get(c['curriculumId'],{})
 check(c['grade']==r.get('grade') and c['subject']==r.get('subject'),ident+': wrong curriculum grade/subject')
 check(c['weekIntroduced']==r.get('weekOf') and c['weekIntroduced']<=CUTOFF,ident+': future or unsupported date')
 check(c['standard'] in r.get('standardReferences',[]) or (c.get('session') and (c['standard'] is None or c['standard'] in c['evidence']['quote'])),ident+': unsupported standard/session')
 for week,cid in zip(c['alignedWeeks'],c['curriculumIds']):
  rr=curr[cid];check(week<=CUTOFF and rr['weekOf']==week and rr['grade']==c['grade'] and rr['subject']==c['subject'],ident+': invalid recurring timing')
 for ev in [c['evidence']]+([c['verificationEvidence']] if c.get('verificationEvidence') else []):
  source=read('content/sources/'+ev['document']);offset=ev['characterOffset']
  check(source['content'][offset:offset+len(ev['quote'])]==ev['quote'] and source['url']==ev['sourceUrl'],ident+': evidence not found')
 check(c['requiresExternalClassroomMaterial'] is False and not c.get('teacherSetup'),ident+': external materials')
 check(c['difficulty'] in [1,2,3] and c['question'].strip() and c['answer'].strip(),ident+': missing core field')
 check(len(c['question'])<=240 and len(c['answer'])<=300,ident+': Smart Board length')
 check(c['grade'] not in ['K','1'] or (c['teacherRead'] and len(c['question'].split())<=30),ident+': K/1 wording/read flag')
 check(not re.search(r'pretend|nation—|city—|picture.*in your mind|our (?:chart|word wall|worksheet)|from our lesson',c['question'],re.I),ident+': artificial/external prompt')
 key=(c['grade'],re.sub(r'\s+',' ',c['question'].lower()).strip());check(key not in norms,ident+': duplicate wording');norms.add(key)
for i,a in enumerate(retained):
 for b in retained[i+1:]:
  # Variants of one template differ only in their numbers or objects by design; compare across families only.
  if a['grade']!=b['grade'] or family(a)==family(b):continue
  norm=lambda q:re.sub(r'\d+','#',re.sub(r'\s+',' ',q.lower()))
  ratio=SequenceMatcher(None,norm(a['question']),norm(b['question'])).ratio()
  if ratio>=.80:near.append({'ids':[a['id'],b['id']],'similarity':round(ratio,3)})
check(not near,'Unresolved near-duplicate candidates')
# Maximum bipartite assignment mirrors the shared engine; Review cannot double-count.
# Matching is by family (template variants share their parent's), so a template covers one tile at most.
def plan(qs):
 slots=[(s,d,i) for s in ['Literacy','Math','Science','Social Studies','Review'] for d in [1,2,3] for i in [0,1]];owners={}
 def match(n,seen):
  s,d,_=slots[n]
  for q in qs:
   f=family(q)
   if q['difficulty']!=d or (s!='Review' and q['subject']!=s) or f in seen:continue
   seen.add(f);prev=owners.get(f)
   if prev is None or match(prev,seen):owners[f]=n;return True
  return False
 for n in range(30):match(n,set())
 return len(owners),[{'subject':s,'difficulty':d,'missing':sum(n not in owners.values() for n,x in enumerate(slots) if x[:2]==(s,d))} for s in ['Literacy','Math','Science','Social Studies','Review'] for d in [1,2,3] if any(n not in owners.values() for n,x in enumerate(slots) if x[:2]==(s,d))]
rows=[]
for grade in ['K','1','2','3','4','5']:
 pool=[q for q in retained if q['grade']==grade];matched,gaps=plan(pool)
 rows.append({'grade':grade,'candidatesEvaluated':sum(q['grade']==grade for q in cs),'newCandidates':sum(q['grade']==grade and not q['id'].startswith('tomorrow-dcss-') for q in cs),'classroomAccepted':len(pool),'tilesCovered':matched,'status':'READY' if matched==30 else 'BLOCKED','gaps':gaps,'subjects':dict(Counter(q['subject'] for q in pool)),'difficulties':dict(Counter(q['difficulty'] for q in pool))})
report={'pack':PACK,'cutoff':CUTOFF,'approvalBasis':'Automated checks plus assistant editorial review authorized for this pack; not human teacher approval.','grades':rows,'errors':errors,'nearDuplicates':near,'sourceProblems':['Fourth-grade deck conflates Declaration adoption/signing; those date questions excluded.','Fifth-grade citizenship deck has an incorrect answer key and oversimplified naturalization rules; excluded.','Second-grade notes contain advanced teacher-only astronomy and historical biographical text; not treated as current student content.','Third-grade science source conflicts on advanced rock taxonomy/streak/cleavage; excluded.','GaDOE Kindergarten lesson 1449 retrieval was blocked by its web security gateway.','Five geography gaps resolved with verified city/state address comparisons and the linked Unit 2 compass evidence; no category substitution or filler.']}
write('content/reports/TOMORROW_PACK_VALIDATION.json',report)
print(json.dumps(report,indent=2))
if errors:sys.exit(1)
pack=[]
for c in retained:
 q={k:v for k,v in c.items() if k not in ['decision','selectionReason']};q.update(packId='dcss-tomorrow-2026-09-14',packName=PACK,approvalBasis='automated-editorial',reviewStatus='approved',reviewNote=c['selectionReason'],source=PACK,reviewQuestion=True)
 q['auditFingerprint']=hashlib.sha256(json.dumps(c,sort_keys=True).encode()).hexdigest();pack.append(q)
write('src/data/tomorrow-pack.json',pack)
# Five varied examples per grade, short enough for quick human spot-checking.
lines=['# Tomorrow Pack spot-check','',report['approvalBasis'],'']
for grade in ['K','1','2','3','4','5']:
 pool=[q for q in pack if q['grade']==grade];picked=[]
 for subject in ['Literacy','Math','Science','Social Studies']:
  options=[q for q in pool if q['subject']==subject];picked.append(options[0])
 picked.append(next(q for q in pool if q['difficulty']==3 and q not in picked))
 lines+=['## '+('Kindergarten' if grade=='K' else 'Grade '+grade),'']
 for q in picked:lines += [f'- **{q["subject"]}, {q["difficulty"]} pt:** {q["question"]} → **{q["answer"]}**']
 lines+=['']
(ROOT/'content/reports/TOMORROW_SPOT_CHECK.md').write_text('\n'.join(lines))
