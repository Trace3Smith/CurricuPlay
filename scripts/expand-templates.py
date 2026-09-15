"""Offline, deterministic expansion of pilot question templates into static variants. No network or AI calls.
Reads content/templates/pilot-templates.json; writes content/templates/pilot-variants.json and
content/reports/TEMPLATE_PILOT.md. Staging only: nothing in src/data, the ingest, or the game reads these files.
Each variant's answer, difficulty invariant, and taught range are re-derived by parsing the rendered text,
independently of the values the generator chose."""
import json,re,hashlib,random,sys
from pathlib import Path
from difflib import SequenceMatcher
ROOT=Path(__file__).resolve().parents[1]
CUTOFF='2026-09-13'
def read(p):return json.loads((ROOT/p).read_text())
def write(p,v):(ROOT/p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
WORDS=['zero','one','two','three','four','five','six','seven','eight','nine','ten']
def word(n):return WORDS[n].capitalize()
def article(noun):return 'an' if noun[0] in 'aeiou' else 'a'
def bar(n):return '━'*n
def digits(n):return [int(d) for d in str(n)]
def spread(items,count):
 # Review sample: evenly spaced through the (already ordered) variant list, including both ends.
 if len(items)<=count:return list(items)
 return [items[round(i*(len(items)-1)/(count-1))] for i in range(count)]

# ---- generators: every candidate that satisfies the template constraints -------------------------------------
def gen_length(t):
 p=t['params'];out=[]
 for a in range(p['a']['min'],p['a']['max']+1):
  for b in range(p['b']['min'],p['b']['max']+1):
   lo,hi=sorted((a,b))
   if hi-lo>=2 and hi>=1.5*lo:
    out.append(({'a':a,'b':b,'longerLetter':'A' if a>b else 'B'},f'Which line is longer? A: {bar(a)} B: {bar(b)}','A.' if a>b else 'B.'))
 return out
def gen_position(t):
 out=[]
 for w in t['params']['word']['list']:
  for obj,ref in t['params']['scene']['byWord'][w]:
   q=f'{article(obj).capitalize()} {obj} is {w} {article(ref)} {ref}. What word tells where the {obj} is?'
   a={'beside':'Beside (next to is also correct).','next to':'Next to (beside is also correct).'}.get(w,w.capitalize()+'.')
   out.append(({'word':w,'object':obj,'reference':ref},q,a))
 return out
def gen_join(t):
 p=t['params'];out=[]
 for animals,place in p['scene']['list']:
  for a in range(p['a']['min'],p['a']['max']+1):
   for b in range(p['b']['min'],p['b']['max']+1):
    if a+b<=10:out.append(({'a':a,'b':b,'animals':animals},f'{word(a)} {animals} {place}. {word(b)} more join them. How many {animals} are there now?',f'{a+b} {animals}.'))
 return out
def gen_make_ten(t):
 p=t['params'];out=[]
 for big in p['big']['list']:
  for small in range(p['small']['min'],p['small']['max']+1):
   if small==big or (big==8 and small==9) or not 11<=big+small<=18:continue
   move=10-big
   for order in p['order']['list']:
    x,y=(big,small) if order=='big first' else (small,big)
    out.append(({'big':big,'small':small,'order':order},f'How can making a ten help you solve {x} + {y}?',f'{big+small}. Move {move} from {small} to {big}: 10 + {small-move} = {big+small}.'))
 return out
def regroups(a,b):
 ones=a%10+b%10>=10;tens=a//10%10+b//10%10+ones>=10
 return ones,tens
def gen_add_context(t):
 p=t['params'];out=[]
 for ci,(sentence,unit) in enumerate(p['context']['list']):
  for a in range(p['a']['min'],p['a']['max']+1):
   if 0 in digits(a):continue
   for b in range(max(a+1,p['b']['min']),p['b']['max']+1):
    if 0 in digits(b) or a+b>999:continue
    ones,tens=regroups(a,b)
    if ones!=tens:
     # Alternate which addend comes first by context so both orders appear.
     x,y=(a,b) if ci%2==0 else (b,a)
     out.append(({'a':x,'b':y,'unit':unit,'regroupColumn':'ones' if ones else 'tens'},sentence.format(a=x,b=y),f'{a+b} {unit}.'))
 return out
PLACES=['ten-thousands','thousands','hundreds','tens','ones']
def gen_expanded(t):
 out=[]
 for zero in t['params']['zeroPlace']['list']:
  zi=PLACES.index(zero)
  for n in range(10000,100000):
   d=digits(n)
   if d.count(0)==1 and d[zi]==0:
    terms=' + '.join(f'{v*10**(4-i):,}' for i,v in enumerate(d) if v)
    out.append(({'n':n,'zeroPlace':zero},f'Write {n:,} in expanded form.',f'{terms}.'))
 return out
def gen_volume(t):
 p=t['params'];out=[]
 for layers in range(p['layers']['min'],p['layers']['max']+1):
  for per in p['perLayer']['list']:
   if 12<=layers*per<=72:out.append(({'layers':layers,'perLayer':per},f'A rectangular prism has {layers} layers, with {per} unit cubes in each layer. What is its volume?',f'{layers*per} cubic units.'))
 return out

# ---- verifiers: parse the rendered text only; return a list of problems ---------------------------------------
def ver_length(q,a):
 m=re.fullmatch(r'Which line is longer\? A: (━+) B: (━+)',q)
 if not m:return ['unexpected wording']
 x,y=len(m[1]),len(m[2]);lo,hi=sorted((x,y));e=[]
 if not(2<=x<=8 and 2<=y<=8):e.append('line length outside 2-8')
 if hi-lo<2 or hi<1.5*lo:e.append('difference not obvious enough for 1 point')
 if a!=('A.' if x>y else 'B.'):e.append('wrong answer')
 return e
TAUGHT=['above','below','beside','in front of','behind','next to']
def ver_position(q,a):
 m=re.fullmatch(r'(A|An) ([a-z ]+?) is (above|below|beside|in front of|behind|next to) (a|an) ([a-z ]+)\. What word tells where the \2 is\?',q)
 if not m:return ['unexpected wording or untaught positional word']
 e=[]
 if m[1].lower()!=article(m[2]) or m[4]!=article(m[5]):e.append('wrong article')
 if len(re.findall(r'\b(?:above|below|beside|in front of|behind|next to)\b',q))!=1:e.append('more than one positional word')
 if not a.startswith(m[3].capitalize()):e.append('answer does not match the positional word')
 return e
def ver_join(q,a):
 m=re.fullmatch(r'([A-Z][a-z]+) ([a-z]+) [a-z ]+\. ([A-Z][a-z]+) more join them\. How many \2 are there now\?',q)
 if not m or m[1].lower() not in WORDS or m[3].lower() not in WORDS:return ['unexpected wording']
 x,y=WORDS.index(m[1].lower()),WORDS.index(m[3].lower());e=[]
 if x<2 or y<2:e.append('singular group (grammar)')
 if x+y>10:e.append('total above 10 (not taught)')
 if a!=f'{x+y} {m[2]}.':e.append('wrong answer')
 return e
def ver_make_ten(q,a):
 m=re.fullmatch(r'How can making a ten help you solve (\d+) \+ (\d+)\?',q)
 n=re.fullmatch(r'(\d+)\. Move (\d+) from (\d+) to (\d+): 10 \+ (\d+) = (\d+)\.',a)
 if not m or not n:return ['unexpected wording']
 x,y=int(m[1]),int(m[2]);total,move,frm,to,rest,total2=map(int,n.groups());e=[]
 if x+y>20:e.append('sum above 20 (not taught)')
 if not 11<=x+y<=18 or x==y or max(x,y) not in (8,9) or min(x,y)<4:e.append('numbers do not require making a ten')
 if total!=x+y or total2!=x+y or {frm,to}!={x,y} or to!=max(x,y) or to+move!=10 or frm-move!=rest or 10+rest!=x+y:e.append('explanation arithmetic is wrong')
 return e
def ver_add_context(q,a):
 nums=[int(s) for s in re.findall(r'\b\d+\b',q)];unit=re.search(r'How many ([a-z]+)',q)
 if len(nums)!=2 or not unit:return ['unexpected wording']
 x,y=nums;e=[]
 if not(100<=x<=999 and 100<=y<=999):e.append('addend not three-digit')
 if x+y>999:e.append('sum above 999')
 if 0 in digits(x)+digits(y):e.append('zero digit')
 if sum(regroups(x,y))!=1:e.append('not exactly one regroup')
 if a!=f'{x+y} {unit[1]}.':e.append('wrong answer')
 return e
def ver_expanded(q,a):
 m=re.fullmatch(r'Write (\d{2},\d{3}) in expanded form\.',q)
 if not m:return ['unexpected wording']
 n=int(m[1].replace(',',''));d=digits(n);e=[]
 if d.count(0)!=1 or d[0]==0:e.append('not exactly one non-leading zero')
 terms=[int(s.replace(',','')) for s in a.rstrip('.').split(' + ')]
 if sum(terms)!=n or len(terms)!=4 or terms!=sorted(terms,reverse=True) or any(len(str(t).rstrip('0'))!=1 for t in terms):e.append('wrong expanded form')
 return e
def ver_volume(q,a):
 m=re.fullmatch(r'A rectangular prism has (\d+) layers, with (\d+) unit cubes in each layer\. What is its volume\?',q)
 if not m:return ['unexpected wording']
 layers,per=int(m[1]),int(m[2]);e=[]
 if per==10 or all(per%k for k in range(2,per)):e.append('layer size is 10 or prime')
 if not(2<=layers<=6 and 12<=layers*per<=72):e.append('outside pilot range')
 if a!=f'{layers*per} cubic units.':e.append('wrong answer')
 return e
KINDS={'tpl-K-math-length-name':(gen_length,ver_length),'tpl-K-math-position-describe':(gen_position,ver_position),'tpl-1-math-join':(gen_join,ver_join),
 'tpl-2-math-make-ten':(gen_make_ten,ver_make_ten),'tpl-3-math-add-context':(gen_add_context,ver_add_context),'tpl-4-math-expanded-form':(gen_expanded,ver_expanded),
 'tpl-5-math-volume-layers':(gen_volume,ver_volume)}

def main():
 templates=read('content/templates/pilot-templates.json');bank=read('src/data/questions.json');byid={q['id']:q for q in bank}
 code_hash=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
 errors=[];variants=[];report=[]
 for t in templates:
  gen,ver=KINDS[t['id']];parent=byid[t['parentQuestionId']];ident=t['id']
  # Template approval is tied to this fingerprint: editing the template or this script invalidates it.
  fingerprint=hashlib.sha256((json.dumps(t,sort_keys=True,ensure_ascii=False)+code_hash).encode()).hexdigest()
  if parent['subject']!='Math' or parent['requiresExternalClassroomMaterial'] or parent.get('teacherSetup'):errors.append(f'{ident}: parent is not a self-contained Math question')
  src=read('content/sources/'+t['rangeLimit']['document'])['content']
  if t['rangeLimit']['quote'] not in src:errors.append(f'{ident}: range citation not found in source')
  ev=parent['evidence']
  if read('content/sources/'+ev['document'])['content'][ev['characterOffset']:ev['characterOffset']+len(ev['quote'])]!=ev['quote']:errors.append(f'{ident}: parent evidence not found')
  if parent['weekIntroduced']>CUTOFF:errors.append(f'{ident}: parent introduced after cutoff')
  pool=gen(t)
  if ver(parent['question'],parent['answer']):errors.append(f'{ident}: parent itself fails the template verifier: {ver(parent["question"],parent["answer"])}')
  existing={q['question'] for q in bank if q['grade']==parent['grade']}
  # uniqueBy: candidates sharing these values count as one variant (e.g. 8 + 6 and 6 + 8), including the parent's own values.
  key=lambda c:tuple(c[0].get(k) for k in t.get('uniqueBy',[]))
  taken={key(c) for c in pool if c[1] in existing} if t.get('uniqueBy') else set()
  pool=[c for c in pool if c[1] not in existing and (not t.get('uniqueBy') or key(c) not in taken)]
  if len({c[1] for c in pool})!=len(pool):errors.append(f'{ident}: generator produced duplicate text')
  if t.get('uniqueBy'):pool_size=len({key(c) for c in pool})
  else:pool_size=len(pool)
  # Deterministic pick: shuffle each stratum with a template-seeded RNG, then deal round-robin across strata.
  # Within a stratum, prefer a candidate whose distinctBy values (e.g. the number pair) haven't been used yet.
  rng=random.Random(int(hashlib.sha256(ident.encode()).hexdigest(),16));strata={}
  by=t['stratifyBy'] if isinstance(t['stratifyBy'],list) else [t['stratifyBy']]
  for c in pool:strata.setdefault(tuple(str(c[0].get(k)) for k in by),[]).append(c)
  for s in strata.values():rng.shuffle(s)
  picked=[];keys=sorted(strata);used=set();distinct=lambda c:tuple(c[0].get(k) for k in t.get('distinctBy',[]))
  while len(picked)<t['variantCap'] and any(strata.values()):
   for k in keys:
    if strata[k] and len(picked)<t['variantCap']:
     i=next((i for i,c in enumerate(strata[k]) if distinct(c) not in used),len(strata[k])-1)
     c=strata[k].pop(i)
     if t.get('uniqueBy') and key(c) in taken:continue
     picked.append(c);used.add(distinct(c));taken.add(key(c))
  others=[q for q in bank if q['grade']==parent['grade'] and q['subject']==parent['subject'] and q['id']!=parent['id']]
  norm=lambda s:re.sub(r'\d+','#',re.sub(r'\s+',' ',s.casefold()).strip())
  near=[];rows=[]
  for i,(params,question,answer) in enumerate(picked,1):
   vid=f'{parent["id"]}-v{i:02d}';problems=ver(question,answer)
   if len(question)>240 or len(answer)>300:problems.append('Smart Board length limit')
   if parent['grade'] in ['K','1'] and len(question.split())>30:problems.append('K/1 prompt over 30 words')
   if re.search(r'pretend|picture.*in your mind|our (?:chart|word wall|worksheet)|from our lesson',question,re.I):problems.append('artificial/external prompt')
   errors+=[f'{vid}: {p}' for p in problems]
   for o in others:
    if SequenceMatcher(None,norm(question),norm(o['question'])).ratio()>=.84:near.append([vid,o['id']])
   v={k:val for k,val in parent.items() if k not in ['id','question','answer','reviewStatus','reviewNote']}
   v.update(id=vid,question=question,answer=answer,templateId=ident,templateParentId=parent['id'],templateFingerprint=fingerprint,templateParams=params,
    reviewStatus='pending',reviewNote='Template variant. Approval comes from the template sample review and automated checks; not yet approved.')
   variants.append(v);rows.append(v)
  report.append((t,parent,pool_size,rows,near,fingerprint))
 write('content/templates/pilot-variants.json',variants)
 lines=['# Template pilot: generated variants','','Staging output only. Not read by the app, the ingest, or the Tomorrow Pack build. All variants are pending.','',
  f'Automated check errors: {len(errors)}','']
 for t,parent,pool,rows,near,fingerprint in report:
  lines+=[f'## {t["id"]}','',f'- Parent ({parent["grade"]}, {parent["difficulty"]} pt, {parent["standard"]}): {parent["question"]} → **{parent["answer"]}**',
   f'- Valid combinations: {pool}; variants written: {len(rows)}',f'- Range source ({t["rangeLimit"]["document"]}): "{t["rangeLimit"]["quote"]}"',
   f'- Near-duplicates of other bank questions: {len(near)}',f'- Fingerprint: `{fingerprint[:12]}`','','**Review sample:**','']
  lines+=[f'{n}. {v["question"]} → **{v["answer"]}**' for n,v in enumerate(spread(rows,t['reviewSampleSize']),1)]
  lines+=['','<details><summary>All variants</summary>','']+[f'- `{v["id"]}` {v["question"]} → {v["answer"]}' for v in rows]+['','</details>','']
 (ROOT/'content/reports/TEMPLATE_PILOT.md').write_text('\n'.join(lines))
 print(json.dumps({'templates':len(templates),'variants':len(variants),'byTemplate':{t['id']:[pool,len(rows),len(near)] for t,_,pool,rows,near,_ in report},'errors':errors},indent=1,ensure_ascii=False))
 sys.exit(bool(errors))
if __name__=='__main__':main()
