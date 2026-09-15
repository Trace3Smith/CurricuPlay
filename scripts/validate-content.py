"""Validate source fidelity and draft coverage; fail on structural or provenance errors."""
import json,re,sys,hashlib
from pathlib import Path
from collections import Counter
from datetime import date
from difflib import SequenceMatcher
ROOT=Path(__file__).resolve().parents[1]
AS_OF='2026-09-13'
def read(p):return json.loads((ROOT/p).read_text())
def valid_date(s):
 try:return isinstance(s,str) and date.fromisoformat(s).isoformat()==s
 except (ValueError,TypeError):return False
def nonempty(x):return isinstance(x,str) and bool(x.strip())
def family(q):return q.get('templateParentId') or q['id']
records=read('src/data/curriculum.json');questions=read('src/data/questions.json');source=read('content/sources/pacing-guide-cells.json')
audits=read('content/material-audit.json')
errors=[];warnings=[]
def check(cond,msg):
 if not cond:errors.append(msg)
lookup={r['id']:r for r in records}
source_rows={}
for tab in source['sheets']:
 for b in tab['data']:
  for ri,row in enumerate(b.get('rowData',[]),b.get('startRow',0)+1):
   source_rows[(tab['properties']['title'],ri)]=row.get('values',[])
check(len(lookup)==len(records),'Duplicate curriculum IDs')
for r in records:
 ident=r.get('id','missing-id')
 for key in ['id','grade','subject','source','sourceUrl','sourceSheet','generationStatus','reason']:check(nonempty(r.get(key)),f'{ident}: missing {key}')
 check(r.get('grade') in ['K','1','2','3','4','5'],f'{ident}: invalid grade')
 check(r.get('subject') in ['Literacy','Math','Science','Social Studies','Science & Social Studies'],f'{ident}: invalid subject')
 check(r.get('needsAdditionalSourceMaterial') is True,f'{ident}: unresolved source material must remain explicit')
 check(bool(r.get('sourceCells')),f'{ident}: no source cells')
 rawrow=source_rows[(r['sourceSheet'],r['sourceRow'])]
 for c in r['sourceCells']:
  match=re.fullmatch(r'([A-Z]+)(\d+)',c['cell']);check(bool(match),f'{ident}: invalid source coordinate')
  idx=0
  for letter in match[1]:idx=idx*26+ord(letter)-64
  check(int(match[2])==r['sourceRow'] and rawrow[idx-1].get('formattedValue')==c['text'],f'{ident}: altered source text {c["cell"]}')
 if r['weekOf'] is None:
  check(r['generationStatus']=='needs_timing_review',f'{ident}: undated row not flagged')
 else:
  check(valid_date(r['weekOf']) and '2026-08-03'<=r['weekOf']<='2027-05-17',f'{ident}: unsupported school-year date')
  check(date.fromisoformat(r['weekOf']).weekday()==0,f'{ident}: Week of is not Monday')
  check(1<=r['instructionalWeek']<=36,f'{ident}: missing instructional-week number')
  # Date is derived ONLY from the literal Week of column and the explicitly titled FY27 school year.
  check(date.fromisoformat(r['weekOf']).strftime('%b %-d')==r['sourceDateText'],f'{ident}: date differs from source Week of')
for grade in ['K','1','2','3','4','5']:
 weeks={r['instructionalWeek'] for r in records if r['grade']==grade and r['weekOf']}
 check(weeks==set(range(1,37)),f'{grade}: incomplete instructional weeks')
ids=[q['id'] for q in questions];check(len(ids)==len(set(ids)),'Duplicate question IDs')
withdrawn=read('content/withdrawn-questions.json')
# Template variants (merged only by ingest --with-templates) must match their current template and approval.
templates={t['id']:t for t in read('content/templates/pilot-templates.json')};approvals=read('content/templates/template-approvals.json')
script_hash=hashlib.sha256((ROOT/'scripts/expand-templates.py').read_bytes()).hexdigest()
def template_fingerprint(t):return hashlib.sha256((json.dumps(t,sort_keys=True,ensure_ascii=False)+script_hash).encode()).hexdigest()  # same formula as expand-templates.py
check(not set(ids)&set(withdrawn),'Withdrawn content must not appear in the active bank')
normalized={};near=[];long=[];teacher=[]
def norm(s):return re.sub(r'\s+',' ',s.casefold()).strip()
for q in questions:
 ident=q.get('id','missing-id')
 for key in ['id','grade','subject','question','answer','source','sourceUrl','curriculumId','reviewStatus']:
  check(nonempty(q.get(key)),f'{ident}: missing {key}')
 check(q['grade'] in ['K','1','2','3','4','5'] and q['subject'] in ['Literacy','Math','Science','Social Studies'],f'{ident}: invalid classification')
 check(type(q.get('requiresExternalClassroomMaterial')) is bool,f'{ident}: missing material audit boolean')
 audit=audits.get(q.get('templateParentId') or ident,{})  # template variants share their parent's materials audit
 check(audit.get('requiresExternalClassroomMaterial')==q.get('requiresExternalClassroomMaterial'),f'{ident}: material flag differs from audit')
 if audit.get('replacement') and not q.get('templateId'):
  check(q['question']==audit['replacement']['question'] and q['answer']==audit['replacement']['answer'] and not q.get('teacherSetup'),f'{ident}: replacement differs from reviewed ingestion input')
 check(not q.get('teacherSetup') or q['requiresExternalClassroomMaterial'],f'{ident}: preparation-dependent content marked playable')
 check(q['difficulty'] in [1,2,3],f'{ident}: invalid difficulty')
 check(valid_date(q['weekIntroduced']) and q['weekIntroduced']<=AS_OF,f'{ident}: future/invalid introduction')
 check(q['reviewStatus'] in ['pending','approved'],f'{ident}: invalid review status')
 check(nonempty(q['standard']) or nonempty(q.get('session')),f'{ident}: neither standard nor session')
 check(q['curriculumId'] in lookup,f'{ident}: missing curriculum record')
 rec=lookup[q['curriculumId']]
 check(rec['grade']==q['grade'] and rec['subject']==q['subject'] and rec['weekOf']==q['weekIntroduced'],f'{ident}: unsupported primary mapping')
 if q['standard']:
  check(q['standard'] in rec['standardReferences'] or (q.get('session') and q['standard'] in q['evidence']['quote'] and q['standardSource']==q['evidence']['sourceUrl']),f'{ident}: standard not supported by primary row or explicit linked lesson evidence')
 check(len(q['alignedWeeks'])==len(q['curriculumIds']) and len(set(q['alignedWeeks']))==len(q['alignedWeeks']),f'{ident}: duplicate or mismatched aligned weeks')
 check(min(q['alignedWeeks'])==q['weekIntroduced'],f'{ident}: introduction not earliest aligned week')
 for w,cid in zip(q['alignedWeeks'],q['curriculumIds']):
  check(valid_date(w) and q['weekIntroduced']<=w<=AS_OF,f'{ident}: future aligned week')
  r=lookup.get(cid,{})
  check(r.get('weekOf')==w and r.get('grade')==q['grade'] and r.get('subject')==q['subject'],f'{ident}: invalid aligned mapping')
 if q.get('templateId'):
  template=templates.get(q['templateId']);approval=approvals.get(q['templateId'],{})
  check(bool(template) and template['parentQuestionId']==q['templateParentId'],f'{ident}: unknown template or parent')
  check(bool(template) and q['templateFingerprint']==template_fingerprint(template),f'{ident}: variant is stale; re-run expand-templates.py')
  if q['reviewStatus']=='approved':
   check(approval.get('status')=='approved' and approval.get('templateFingerprint')==q['templateFingerprint'] and set(approval.get('sampleVariantIds',[]))<=set(ids),f'{ident}: approved variant lacks a current template approval')
 ev=q.get('evidence',{})
 for key in ['document','sourceUrl','sourceTitle','section','quote','timingBasis']:check(nonempty(ev.get(key)),f'{ident}: missing evidence {key}')
 d=read('content/sources/'+ev['document']);offset=ev['characterOffset']
 check(d['content'][offset:offset+len(ev['quote'])]==ev['quote'] and ev['sourceUrl']==d['url'],f'{ident}: evidence not found in source')
 check(ev in rec['supportingEvidence'],f'{ident}: evidence absent from curriculum')
 # Structural tests cannot certify educational correctness; all machine-generated items remain reviewable drafts.
 key=(q['grade'],norm(q['question']))
 check(key not in normalized,f'{ident}: duplicate question text with {normalized.get(key)}');normalized[key]=ident
 if len(q['question'])>240 or len(q['answer'])>300:long.append(ident)
 if q['grade'] in ['K','1']:
  check(q.get('teacherRead') is True,f'{ident}: K/1 missing read-aloud behavior')
  if len(q['question'].split())>30:warnings.append(f'{ident}: K/1 prompt exceeds 30 words')
 if q['questionType']=='teacher-check' or q.get('teacherSetup'):teacher.append(ident)
for i,a in enumerate(questions):
 for b in questions[i+1:]:
  # Variants of one template differ only in their numbers or objects by design; compare across families only.
  if a['grade']!=b['grade'] or a['subject']!=b['subject'] or family(a)==family(b):continue
  aa=re.sub(r'\d+','#',norm(a['question']));bb=re.sub(r'\d+','#',norm(b['question']))
  if SequenceMatcher(None,aa,bb).ratio()>=.84:near.append([a['id'],b['id']])
check(not long,'Smart Board length limits exceeded: '+', '.join(long))
# Actual eligibility (pending excluded) and post-review potential coverage are reported separately.
coverage=[]
for grade in ['K','1','2','3','4','5']:
 for subject in ['Literacy','Math','Science','Social Studies','Review']:
  for difficulty in [1,2,3]:
   pool=[q for q in questions if q['grade']==grade and (subject=='Review' and q['reviewQuestion'] or q['subject']==subject) and q['difficulty']==difficulty]
   for name,start in [('Recent Content','2026-08-31'),('Everything Taught So Far','2026-08-03')]:
    selected=[q for q in pool if q['requiresExternalClassroomMaterial'] is False and any(start<=w<=AS_OF for w in q['alignedWeeks'])]
    coverage.append({'grade':grade,'category':subject,'difficulty':difficulty,'range':name,'draftQuestions':len(selected),'approvedQuestions':sum(q['reviewStatus']=='approved' for q in selected)})
# Counts are unique across all subjects: Review never adds another copy of a question.
requirements={'tilesPerGame':30,'minimumEligibleUniqueQuestionsPerGrade':30,'targetApprovedUniqueQuestionsPerGrade':60,'tilesPerCategoryDifficulty':2}
grade_coverage=[]
for grade in ['K','1','2','3','4','5']:
 for name,start in [('Recent Content','2026-08-31'),('Everything Taught So Far','2026-08-03')]:
  eligible=[q for q in questions if q['requiresExternalClassroomMaterial'] is False and q['grade']==grade and q['weekIntroduced']<=AS_OF and any(start<=w<=AS_OF for w in q['alignedWeeks'])]
  # A template and all its variants are one family and count once toward coverage.
  drafts=len({family(q) for q in eligible})
  approved=len({family(q) for q in eligible if q['reviewStatus']=='approved'})
  grade_coverage.append({'grade':grade,'range':name,'eligibleGeneratedUnique':drafts,'eligibleApprovedUnique':approved,
   'approvedShortfallForFullGame':max(0,30-approved),'approvedShortfallForVariationTarget':max(0,60-approved),
   'additionalDraftsNeededEvenIfAllApprovedForFullGame':max(0,30-drafts),
   'additionalDraftsNeededEvenIfAllApprovedForVariationTarget':max(0,60-drafts),
   'undersuppliedDraftPools':[{'category':c['category'],'difficulty':c['difficulty'],'available':c['draftQuestions'],'shortfall':max(0,2-c['draftQuestions'])} for c in coverage if c['grade']==grade and c['range']==name and c['draftQuestions']<2],
   'undersuppliedApprovedPools':[{'category':c['category'],'difficulty':c['difficulty'],'available':c['approvedQuestions'],'shortfall':max(0,2-c['approvedQuestions'])} for c in coverage if c['grade']==grade and c['range']==name and c['approvedQuestions']<2]})
report={'withdrawnQuestionIds':list(withdrawn),'materialAudit':{'existingExternal':sum(a['requiredExternalBefore'] for a in audits.values()),'replaced':sum(a['resolution']=='replaced' for a in audits.values()),'excluded':sum(q['requiresExternalClassroomMaterial'] for q in questions),'selfContainedByGrade':dict(Counter(q['grade'] for q in questions if q['requiresExternalClassroomMaterial'] is False))},'coverageRequirements':requirements,'gradeCoverage':grade_coverage,'asOf':AS_OF,'curriculumRecords':len(records),'datedCurriculumRecords':sum(r['weekOf'] is not None for r in records),'undatedCurriculumRecords':sum(r['weekOf'] is None for r in records),
 'scheduledFutureCurriculumRecords':sum(r['weekOf'] is not None and r['weekOf']>AS_OF for r in records),
 'curriculumByGrade':dict(Counter(r['grade'] for r in records)),
 'questions':len(questions),'questionsByGrade':dict(Counter(q['grade'] for q in questions)),'questionsBySubject':dict(Counter(q['subject'] for q in questions)),
 'questionsByDifficulty':dict(Counter(q['difficulty'] for q in questions)), 'approvedQuestions':sum(q['reviewStatus']=='approved' for q in questions),
 'curriculumWithoutQuestionEvidence':[r['id'] for r in records if not r['supportingEvidence']],
 'partiallySupportedCurriculum':[r['id'] for r in records if r['supportingEvidence']],
 'errors':errors,'warnings':warnings,'nearDuplicateCandidates':near,'overlongQuestions':long,'teacherCheckedOrMaterialsRequired':teacher,
 'coverage':coverage,'limitations':['All generated questions require teacher review. Exact evidence matching verifies provenance, not semantic correctness.',
 '30 eligible unique questions is a necessary minimum; target at least 60 approved per grade for variation, not a generation cap. Category/difficulty coverage is also required; overlapping Review pools cannot be double-counted. See gradeCoverage shortages.',
 'Age appropriateness was editorially checked; length/read-aloud checks are automated proxies, not a reading-level guarantee.',
 'Only instruction through the cutoff is considered for generation. Future calendar rows are retained as planned, never backdated into questions.']}
(ROOT/'content/reports/validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k in ['curriculumRecords','datedCurriculumRecords','undatedCurriculumRecords','questionsByGrade','questionsBySubject','questionsByDifficulty','errors','warnings','nearDuplicateCandidates','approvedQuestions']},indent=2))
sys.exit(bool(errors))
