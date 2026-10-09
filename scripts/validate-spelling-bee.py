"""Read-only validation of the intentionally non-curriculum Spelling Bee sample bank."""
import json
import re
from collections import Counter
from pathlib import Path
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
words = json.loads((root / 'src/data/spelling-bee.json').read_text())
errors = []
seen_ids, seen_words = set(), set()
pictures = {**{name: f'spelling-bee/{name}.svg' for name in ['sit', 'map', 'ship', 'cake', 'night', 'rain']}, 'cat': 'spelling-bee/cat.svg', 'sun': 'spelling-bee/sun.svg', 'plant': 'four-corners/plant.svg', 'leaf': 'four-corners/plant-leaf.svg'}
for row, word in enumerate(words, 1):
    prefix = f'Row {row}: '
    check = lambda condition, error: errors.append(prefix + error) if not condition else None
    check(word['grade'] in ['K', '1', '2', '3', '4', '5'], 'invalid grade')
    check(bool(re.fullmatch('[a-z]{1,16}', word['word'])), 'invalid physical-letter word')
    check(word['id'] not in seen_ids, 'duplicate ID')
    check((word['grade'], word['word']) not in seen_words, 'duplicate grade/word')
    seen_ids.add(word['id']); seen_words.add((word['grade'], word['word']))
    check(0 < len(word['clue']) <= 180, 'invalid clue length')
    check(not re.search(r'\b' + re.escape(word['word']) + r'\b', word['clue'], re.I), 'clue includes answer')
    check(0 < len(word['skill']) <= 80, 'invalid skill')
    check(word['kind'] == 'sample' and 'not district pacing-guide vocabulary' in word['source'], 'unsupported provenance')
    check(word['reviewStatus'] == 'approved', 'unreviewed sample')
    check(word['picture'] is None or word['picture'] in pictures, 'unreviewed image reference')
    if word['grade'] in ['K', '1', '2'] and word['word'] in pictures:
        check(word['picture'] == word['word'], 'missing or mismatched picture for a concrete sample word')
for picture, path in pictures.items():
    file = root / 'public' / path
    if not file.is_file(): errors.append(f'Missing picture: {picture}'); continue
    tree = ET.parse(file)
    if tree.getroot().tag != '{http://www.w3.org/2000/svg}svg': errors.append(f'Invalid SVG: {picture}')
    if any(node.tag.endswith('script') or any(key.lower().startswith('on') for key in node.attrib) for node in tree.iter()): errors.append(f'Active image content: {picture}')
counts = Counter(word['grade'] for word in words)
if any(counts[g] < 5 for g in ['K', '1', '2', '3', '4', '5']): errors.append('Insufficient sample grade coverage')
print(json.dumps({'words': len(words), 'byGrade': dict(counts), 'localPictures': len(pictures), 'errors': errors}, indent=2))
raise SystemExit(bool(errors))
