"""Validate the expanded bank and reproducibly write its date-specific content audit."""
import csv,json,re
from pathlib import Path
from collections import Counter
from datetime import date,timedelta
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
CUTOFF='2026-10-09'
bank=json.loads((ROOT/'src/data/spelling-bee-pacing.json').read_text())
general=json.loads((ROOT/'src/data/spelling-bee-general.json').read_text())
evidence={e['id']:e for e in json.loads((ROOT/'content/spelling-bee/evidence.json').read_text())}
pictures=json.loads((ROOT/'src/data/spelling-bee-pictures.json').read_text())
pictures.update({name:dict(src=f'/spelling-bee/{name}.svg') for name in ['cat','sun','sit','map','ship','cake','night','rain']})
pictures.update(plant=dict(src='/four-corners/plant.svg'),leaf=dict(src='/four-corners/plant-leaf.svg'))
pictures.update(json.loads((ROOT/'src/data/spelling-bee-pictures.json').read_text()))

def also_accept_ok(w):
    """Optional extra letters for Kindergarten first-letter photos: [{letter: 'C', because: 'coat'}] (same rule as the game)."""
    v = w.get('alsoAccept')
    if v is None: return True
    return w.get('activity') == 'initial' and isinstance(v, list) and 0 < len(v) <= 3 and len({a.get('letter') for a in v if isinstance(a, dict)}) == len(v) and all(
        isinstance(a, dict) and set(a) == {'letter', 'because'} and isinstance(a['letter'], str) and re.fullmatch('[A-Z]', a['letter']) is not None
        and a['letter'] != w['word'][0].upper() and isinstance(a['because'], str) and re.fullmatch('[a-z]{1,16}', a['because']) is not None
        and a['because'][0].upper() == a['letter'] for a in v)
errors=[]
for collection in [bank,general]:
    seen=set()
    for w in collection:
        def check(ok,msg):
            if not ok:errors.append(w['id']+': '+msg)
        check(w['id'] not in seen,'duplicate ID');seen.add(w['id'])
        check(bool(re.fullmatch('[a-z]{1,16}',w['word'])),'invalid word')
        if 'displayWord' in w: check(bool(re.fullmatch('[a-z]+(?:-[a-z]+)+',w['displayWord'])) and w['displayWord'].replace('-','')==w['word'],'invalid display punctuation')
        check(0<len(w['clue'])<=180,'invalid clue')
        check(not re.search(r'\b'+w['word']+r'\b',w['clue'],re.I),'clue leaks word')
        check(w['picture'] is None or w['picture'] in pictures,'missing reviewed picture')
        check(also_accept_ok(w),'invalid alsoAccept')
        if w.get('activity')=='initial':
            check(w['grade']=='K' and w['picture']==w['word'],'initial prompt needs matching object picture')
            check(w['clue']=='What letter does this object start with?','initial prompt prints object name')
        if collection is bank:
            e=w['curriculum'];record=evidence[w['evidenceId']]
            check(all(e[k]==record[k] for k in e),'evidence mismatch')
            source=json.loads((ROOT/record['snapshot']).read_text())
            check(e['sourceUrl']==source['url'],'source URL mismatch')
            check(e['timing']!='documented' or e['earliestEligible']==e['periods'][0]['end'],'week-only content must wait until week end')
            if e['category']=='source-listed':
                start=date.fromisoformat(e['periods'][0]['start']);text=source['content'].replace('\r','')
                pattern=rf'{start.strftime("%b")}\s+{start.day}\s*[–-]'
                match=next((m for m in re.finditer(pattern,text) if m.start()>text.find('📅')-5),None)
                check(match is not None,'weekly source section missing')
                if match:
                    end=text.find('📅',match.end());block=text[match.start():end if end>=0 else None]
                    check(bool(re.search(r'\b'+w['word']+r'\b',block,re.I)),'source-listed term absent from dated week')
        else:check('curriculum' not in w and 'not verified' in w['source'],'general practice must not claim verification')
for name,info in pictures.items():
    path=ROOT/'public'/info['src'].lstrip('/')
    if not path.is_file():errors.append('Missing image '+name);continue
    if path.suffix=='.webp':
        raw=path.read_bytes()
        if raw[:4]!=b'RIFF' or raw[8:12]!=b'WEBP': errors.append(f'Invalid WebP: {path}')
        continue
    if path.suffix=='.png':
        if path.read_bytes()[:8]!=b'\x89PNG\r\n\x1a\n':errors.append('Invalid PNG '+name)
        continue
    for node in ET.parse(path).iter():
        if node.tag.endswith(('script','foreignObject')) or any(k.lower().startswith('on') for k in node.attrib):errors.append('Active image '+name)
        if '/objects/' in info['src'] and node.tag.endswith('text'):errors.append('Letter or name in initial-sound image '+name)
rows=[]
for g in ['K','1','2','3','4','5']:
    allrows=[w for w in bank if w['grade']==g]
    eligible=[w for w in allrows if w['curriculum']['timing']=='documented' and w['curriculum']['earliestEligible']<=CUTOFF]
    current=[w for w in eligible if any(p['start']<='2026-10-09' and p['end']>='2026-10-05' for p in w['curriculum']['periods'])]
    cats=Counter(w['curriculum']['category'] for w in eligible)
    row=dict(grade=g,eligible=len(eligible),current=len(current),earlier=len(eligible)-len(current),sourceListed=cats['source-listed'],skillPractice=cats['skill-practice'],general=sum(w['grade']==g for w in general),excluded=len(allrows)-len(eligible))
    rows.append(row)
    if len(eligible)<30:errors.append(g+': fewer than 30 eligible prompts')
audit=dict(cutoff=CUTOFF,timezone='America/New_York',approval='Editorial review complete; teacher must approve suitability at setup. Schedule does not prove completion or mastery.',grades=rows)
(ROOT/'content/spelling-bee/audit.json').write_text(json.dumps(audit,indent=2)+'\n')
with (ROOT/'content/spelling-bee/audit.csv').open('w') as f:
    out=csv.writer(f);out.writerow(['grade','word/object','answer','category','timing','eligibleAtCutoff','earliestEligible','subject','unit','sourceUrl','locator'])
    for w in bank:
        e=w['curriculum'];out.writerow([w['grade'],w['word'],w['word'][0] if w.get('activity')=='initial' else w['word'],e['category'],e['timing'],e['timing']=='documented' and e['earliestEligible']<=CUTOFF,e['earliestEligible'],e['subject'],e['unit'],e['sourceUrl'],e['locator']])
print(json.dumps(dict(**audit,errors=errors),indent=2))
raise SystemExit(bool(errors))
