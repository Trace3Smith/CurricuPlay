"""Pinned DCSS FY27 source adapter for the preserved offline Games pipeline.

These district/year choices are not universal ClassThread domain defaults.
Returns literal evidence and unresolved timing; never generates instructional content.
"""
import re
from datetime import date

URL='https://docs.google.com/spreadsheets/d/1NHE1-x6b21bcd2f5hEEcm4EZEAv66rty6_paTaPi1yo/edit'
TITLE='DCSS Pacing Guide FY27'
# One curriculum record per nonempty subject in a source row. No forward filling of lessons.
CONFIG={
 'KINDER':('K',{'Literacy':[11,12,13,14,15],'Math':[16],'Science & Social Studies':[17]},10),
 'FIRST':('1',{'Literacy':[11,12,13],'Math':[14],'Science':[15],'Social Studies':[16]},10),
 'SECOND':('2',{'Literacy':[11,12,13,14],'Math':[15],'Science':[16],'Social Studies':[17]},10),
 'THIRD':('3',{'Literacy':[11,12,13],'Math':[14],'Science':[15],'Social Studies':[16]},10),
 'FOURTH':('4',{'Literacy':[11,12],'Math':[13],'Science':[14],'Social Studies':[15]},12),
 'FIFTH':('5',{'Literacy':[11,12,13],'Math':[14],'Science':[15],'Social Studies':[16]},9),
}
MONTHS={m:i+1 for i,m in enumerate(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])}
def col(n):
 s=''
 while n:n,r=divmod(n-1,26);s=chr(65+r)+s
 return s
def normalize_date(v):
 m=re.fullmatch(r'([A-Za-z]+) (\d{1,2})',v.strip())
 if not m:return None
 month=MONTHS[m[1][:3]]
 return date(2026 if month>=8 else 2027,month,int(m[2])).isoformat()
def slug(s):return s.lower().replace(' ','-')
def references(s):
 # Literal tokens only. Do not expand H1 to SS3H1, repair code typos, or assign meanings.
 # Georgia ELA codes are grade.DOMAIN.STRAND.number[.letter] (5.T.T.1.a, 5.L.GC.2, K.F.P.1): two
 # alpha segments after the grade, which is what separates them from the three-part math codes
 # (1.NR.1.1). Matched literally like every other family; no meaning is assigned to a strand.
 return list(dict.fromkeys(re.findall(r'(?<![\w.])(?:[K1-5]\.[A-Z]{1,2}\.[A-Z]{1,2}\.\d+(?:\.[a-z])?|[K1-5]\.(?:NR|PAR|GSR|MDR|MP)[\d.\w-]*|SS[K1-5A-Z][\w.]*|S[K1-5][A-Z][\w.]*|(?:H|G|E|CG)\d[a-z]?)(?!\w)',s)))

def extract_pacing(book):
 records=[];issues=[];tab_report=[]
 for tab in book['sheets']:
  name=tab['properties']['title']; tab_report.append({'tab':name,'hidden':tab['properties'].get('hidden',False),'imported':name in CONFIG,'reason':'K–5 primary pacing tab' if name in CONFIG else 'Context only; outside K–5 primary FY27 pacing'})
  if name not in CONFIG:continue
  grade,groups,start=CONFIG[name];quarter=None
  header_links={}
  for b in tab['data']:
   for n,row in enumerate(b.get('rowData',[]),b.get('startRow',0)+1):
    cells=row.get('values',[])
    def val(i):return cells[i-1].get('formattedValue','') if i<=len(cells) else ''
    if n<start:
     for i,c in enumerate(cells,1):
      if c.get('hyperlink'):header_links[i]=c['hyperlink']
    if 'QUARTER' in val(1):quarter=val(1).strip()
    if n<start:continue
    week=normalize_date(val(3)) if val(3) else None
    number=int(val(2)) if val(2).isdigit() else None
    for subject,columns in groups.items():
     items=[]
     for c in columns:
      raw=val(c)
      if not raw.strip():continue
      cell=cells[c-1];links=[]
      if cell.get('hyperlink'):links.append(cell['hyperlink'])
      for run in cell.get('textFormatRuns',[]):
       link=run.get('format',{}).get('link',{}).get('uri')
       if link:links.append(link)
      items.append({'cell':f'{col(c)}{n}','text':raw,'links':list(dict.fromkeys(links)),**({'headerSourceUrl':header_links[c]} if c in header_links else {})})
     if not items:continue
     # K has a combined column; classify by literal SS / science prefix without interpreting codes.
     targets=[subject]
     if subject=='Science & Social Studies':
      text='\n'.join(x['text'] for x in items)
      targets=(['Science'] if re.search(r'\bSK[EP L]\d',text) else [])+(['Social Studies'] if re.search(r'\bSSK',text) else [])
      if not targets:targets=['Science & Social Studies']
     for target in targets:
      raw='\n'.join(x['text'] for x in items)
      rec={'id':f'dcss-fy27-{grade}-{slug(target)}-r{n}', 'grade':grade,'subject':target,'weekOf':week,'instructionalWeek':number,'quarter':quarter,
       'source':TITLE,'sourceUrl':URL+f'#gid={tab["properties"]["sheetId"]}&range={items[0]["cell"]}', 'sourceSheet':name,'sourceRow':n,
       'sourceDateText':val(3),'sourceCells':items,'standardReferences':references(raw),
       'unitReferences':list(dict.fromkeys(re.findall(r'\b(?:U\d+|Unit\s+\d+)',raw))),
       'sessionReferences':re.findall(r'Sessions?\s+[\d/–-]+',raw),
       'generationStatus':'needs_additional_source_material','needsAdditionalSourceMaterial':True,
       'reason':'Only codes, program references, topic labels or activities; no fully grounded question set yet.', 'supportingEvidence':[]}
      if not week:
       rec['generationStatus']='needs_timing_review';rec['reason']='Source row has content but no Week of date. Not assigned to an adjacent week.'
       issues.append({'type':'undated-content','recordId':rec['id'],'sheet':name,'row':n,'text':raw})
      records.append(rec)
 return records,issues,tab_report
