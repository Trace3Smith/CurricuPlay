"""Offline, deterministic import. No network or AI calls; the workbook owns timing."""
import json, re, hashlib, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'content/sources'
CUTOFF='2026-09-13'
from source_adapters.dcss_fy27 import extract_pacing, slug, TITLE
def read(p):return json.loads(p.read_text())
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def main():
 records,issues,tab_report=extract_pacing(read(SOURCE/'pacing-guide-cells.json'))
 by_key={(r['grade'],r['subject'],r['weekOf']):r for r in records if r['weekOf']}
 questions=[]
 groups=read(ROOT/'content/question-drafts.json')
 for g in groups:
  rec=by_key[(g['grade'],g['subject'],g['weekOf'])]
  assert g['weekOf']<=CUTOFF, 'Future generation is prohibited'
  doc=read(SOURCE/g['document']);text=doc['content'];quote=g['evidence']
  assert quote in text, f'Evidence missing from {g["document"]}: {quote}'
  offset=text.index(quote)
  ev={'document':g['document'],'sourceUrl':doc['url'],'sourceTitle':doc['title'],'section':g['section'],'quote':quote,'characterOffset':offset,'timingBasis':g['timingBasis']}
  for w in g.get('alignedWeeks',[g['weekOf']]):
   assert w<=CUTOFF and w>=g['weekOf']
   aligned=by_key[(g['grade'],g['subject'],w)]
   if ev not in aligned['supportingEvidence']:aligned['supportingEvidence'].append(ev)
   aligned['generationStatus']='partially_supported';aligned['reason']='Cited skill supports draft questions; other references are not yet resolved.'
  rec['generationStatus']='partially_supported';rec['reason']='The cited skill supports generated drafts; other references still need source detail or review.'
  for q in g['questions']:
   ident=f'dcss-{g["grade"]}-{slug(g["subject"])}-{q[0]}'
   questions.append({'id':ident,'grade':g['grade'],'subject':g['subject'],'difficulty':q[1],'question':q[2],'answer':q[3],
    'standard':g.get('standard'),'standardSource':rec['sourceUrl'] if g.get('standard') in rec['standardReferences'] else ev['sourceUrl'],'weekIntroduced':g['weekOf'],'source':TITLE,'curriculumId':rec['id'],
    'sourceUrl':rec['sourceUrl'],'unit':', '.join(rec['unitReferences']) or None,'session':g.get('session'),'evidence':ev,
    'alignedWeeks':g.get('alignedWeeks',[g['weekOf']]),'curriculumIds':[by_key[(g['grade'],g['subject'],w)]['id'] for w in g.get('alignedWeeks',[g['weekOf']])],
    'questionType':'teacher-check' if q[3].startswith('Teacher checks:') else 'short-answer',
    'teacherRead':g['grade'] in ['K','1'],'reviewQuestion':True,'reviewStatus':'pending',
    'reviewNote':'Generated ahead of play. Teacher must check accuracy, pacing fit and difficulty before setting reviewStatus to approved.',
    **({'teacherSetup':q[4]} if len(q)>4 else {})})
 audits=read(ROOT/'content/material-audit.json')
 assert set(audits)=={q['id'] for q in questions}, 'Every draft needs an explicit material audit'
 for q in questions:
  audit=audits[q['id']]
  assert audit['original']==q, f'Material audit is stale for {q["id"]}'
  q['requiresExternalClassroomMaterial']=audit['requiresExternalClassroomMaterial']
  q['materialReviewNote']=audit['gap'] or ('Self-contained replacement; all example data is displayed in the prompt. Re-review before approval.' if audit['replacement'] else 'Audited for self-contained gameplay. Teacher reading is allowed.')
  if audit['replacement']:
   q.update(audit['replacement'])
   q.pop('teacherSetup',None)
   q['questionType']='teacher-check' if q['answer'].startswith('Teacher checks:') else 'short-answer'
 withdrawn=read(ROOT/'content/withdrawn-questions.json')
 assert set(withdrawn)<={q['id'] for q in questions}, 'Unknown withdrawn question'
 for q in questions:
  if q['id'] in withdrawn:
   assert withdrawn[q['id']]['question']==q, 'Withdrawn snapshot is stale'
 questions=[q for q in questions if q['id'] not in withdrawn]
 if '--with-templates' in sys.argv:
  # Opt-in: merge staged template variants. Each inherits its parent's curriculum mapping, evidence and materials
  # audit, so a variant whose parent was withdrawn, needs materials, or has since been remapped is refused.
  inherited=['grade','subject','difficulty','standard','standardSource','weekIntroduced','source','curriculumId','curriculumIds','sourceUrl',
   'unit','session','evidence','alignedWeeks','teacherRead','reviewQuestion','requiresExternalClassroomMaterial','questionType']
  parents={q['id']:q for q in questions}
  for v in read(ROOT/'content/templates/pilot-variants.json'):
   parent=parents.get(v['templateParentId'])
   assert parent, f'Template variant {v["id"]}: parent missing or withdrawn'
   assert audits[parent['id']]['requiresExternalClassroomMaterial'] is False and not parent.get('teacherSetup'), f'Template variant {v["id"]}: parent is not self-contained'
   stale=[k for k in inherited if v.get(k)!=parent.get(k)]
   assert not stale, f'Template variant {v["id"]} is stale ({", ".join(stale)} differ from parent); re-run expand-templates.py'
   questions.append(v)
 assert len({q['id'] for q in questions})==len(questions)
 write(ROOT/'src/data/replacementQuestionIds.json',[key for key,audit in audits.items() if audit['resolution']=='replaced'])
 write(ROOT/'src/data/curriculum.json',records);write(ROOT/'src/data/questions.json',questions)
 write(ROOT/'content/reports/source-issues.json',{'asOf':CUTOFF,'tabs':tab_report,'undatedContent':issues,
  'knownProblems':[
   'KINDER P17: main guide has U1 K.GSR.8.2 on Sep 7; linked math support starts U2 K.NR.1.2. No Sep 7 K math questions generated.',
   'THIRD N17: main guide starts U2 3.PAR.3.2 on Sep 7; linked math support has Unit 1 assessment, and starts Unit 2 Sep 14. No Sep 7 third-grade math questions generated.',
   'FIRST Q3/Q4 labels occur at different weeks from other grades; source placement is preserved, not harmonized.',
   'Main sheet uses abbreviated social studies codes in grade 3 and inconsistent punctuation in several math codes. Raw spelling is retained; meanings are not inferred.',
   'GrammarPlanning contains 2024 dates; K - PA is labeled 2024–2025; Principals Newsletter dates differ from the FY27 primary tabs. Excluded from FY27 mappings.',
   'KINDER K36 has a duplicated Heggerty URL. Retained as source text, not used for questions.',
   'Linked documents include placeholders, assessment codes, source title typos, and timing/standard inconsistencies. No assessment access codes are bundled into the application.',
   'Some grade 3 science supporting statements cover multiple substandards; only sample-observation prompts are generated for the explicitly matching S3E1a period.',
   'Questions needing classroom materials have teacherSetup and teacher-check rubrics. They require teacher preparation, not an assumed universal answer.'
  ]})
 print(f'Imported {len(records)} subject-row curriculum records; generated {len(questions)} pending-review questions.')
if __name__=='__main__':main()
