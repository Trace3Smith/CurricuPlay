"""Reproducible editorial bank. Evidence points to retained, dated district snapshots.
Practice examples and original clues are ClassThread-authored, NOT district spelling assignments.
Every new-game selection requires the teacher to review suitability before playing.
"""
import json,pathlib,datetime,collections
ROOT=pathlib.Path(__file__).resolve().parents[2]
bank=[]; evidence=[]
def group(key,grade,src,start,unit,target,category,rows,timing='documented',note=None,end=None):
    start='2026-'+start
    end=end or (datetime.date.fromisoformat(start)+datetime.timedelta(days=4)).isoformat()
    source=json.loads((ROOT/f'content/sources/spelling-bee-2026-10-09-{src}.json').read_text())
    subject='Science' if src in [7,8,10] else 'Social Studies' if src in [9,11,12] else 'Literacy'
    meta=dict(grade=grade,subject=subject,target=target,source=source['title'],sourceUrl=source['url'],locator=f'Weekly catalog: {start} through {end}; {target}',unit=unit,earliestEligible=end if timing=='documented' else None,periods=[dict(start=start,end=end)],category=category,timing=timing,review='approved',note=note or 'Weekly timing checked against FY27 workbook. Eligible at week end; schedule is not proof of classroom completion. Original ClassThread clues; teacher review required.')
    evidence.append(dict(id=key,snapshot=f'content/sources/spelling-bee-2026-10-09-{src}.json',**meta))
    for line in rows.strip().split('\n'):
        word,clue,*extra=line.split('|'); picture=extra[0] if extra and extra[0] else None
        complexity=extra[1] if len(extra)>1 else ('academic' if grade in ['3','4','5'] else 'foundation')
        bank.append(dict(id=f'pacing-{grade}-{word}',grade=grade,word=word,clue=clue,skill=target[:80],picture=picture,source=f'DCSS FY27 {subject}: '+('source-listed term' if category=='source-listed' else 'practice from documented skill'),kind='curriculum',reviewStatus='approved',curriculum=meta,evidenceId=key,complexity=complexity))
# Kindergarten: only unconflicted Unit 1 introductions. Multiple pictured objects per letter.
for key,start,words in [('m','08-03','map moon mug mitten mouse magnet mushroom'),('t','08-10','tent top turtle tomato tiger towel'),('a','08-10','apple ant ax'),('s','08-17','sun sock soap seal sandwich spoon suitcase'),('b','08-24','ball bat bed bell bus bag boat book'),('i','08-24','igloo')]:
    group('k-'+key,'K',1,start,'Unit 1: Trying New Things',f'Beginning letter {key.upper()} and its sound','skill-practice','\n'.join(f'{w}|What letter does this object start with?|{w}' for w in words.split()),note='Object names are ClassThread practice, not district-assigned words. Unit 1 explicitly introduces this letter. Teacher says object name; child supplies only its first letter.')
    for w in bank:
        if w['grade']=='K': w.update(activity='initial',complexity='foundation')
# Quarantined examples retain conflicts/future evidence instead of silently being made playable.
group('k-unit2-conflict','K',1,'09-21','Unit 2: Color in Art','Beginning C sound','skill-practice','cat|What letter does this object start with?|cat',timing='conflicting',note='Weekly catalog and workbook place Unit 2 in September; document unit overview starts October 19. Excluded until dates are clarified.')
bank[-1]['activity']='initial'
group('1-super-early','1',2,'08-03','Unit 1: Working Together','Super Words: and, see, the, to','source-listed','''and|I have a pencil ___ paper.
see|I use my eyes to ___.
the|Please close ___ door.
to|We walk ___ school.''')
group('1-super-aug','1',2,'08-10','Unit 1: Working Together','Super Words: but, her, not, of','source-listed','''but|I wanted to play outside, ___ it was raining.
her|That girl has a book. It belongs to ___.
not|The light is off. It is ___ on.
of|May I have a cup ___ water?''')
group('1-cvc','1',2,'08-10','Unit 1: Working Together','Short a and short i','skill-practice','''cat|A small pet that says meow.|cat
map|A drawing that shows where places are.|map
sit|Rest on a chair with your feet on the floor.|sit
hat|You wear this on your head.
mat|Wipe your feet on this by the door.
pan|Use this to cook food on a stove.
bag|Carry your books in this.|bag
pin|A small sharp fastener.
cap|A soft hat with a brim.
can|A metal container for food.''')
group('1-digraph','1',2,'09-21','Unit 2: Art All Around Us','Beginning digraphs sh, th, ch, wh','skill-practice','''ship|A large boat that carries people or cargo.|ship
shop|A place where people buy things.
chin|The part of your face below your mouth.
chop|Cut something into pieces.
thin|The opposite of thick.
this|___ is my book, right here.''')
group('1-end-digraph','1',2,'09-28','Unit 2: Art All Around Us','Ending digraphs sh, th, ck','skill-practice','''fish|An animal that lives in water and has fins.
wish|Something you hope will happen.
back|The part of your body behind your chest.
rock|A hard piece of stone.
duck|A bird that swims and quacks.
path|A narrow track you can walk along.''')
group('1-current-direct','1',2,'10-05','Unit 2: Art All Around Us','Super Words: from, have, look, or','source-listed','''from|This letter came ___ my friend.
have|I ___ two hands.
look|Use your eyes to ___ at the picture.
or|Would you like milk ___ water?''')
group('1-current-practice','1',2,'10-05','Unit 2: Art All Around Us','Ending ch, ng and tch','skill-practice','''song|Words and music that people sing.
ring|A small band worn on a finger.
long|The opposite of short.
king|A male ruler who may wear a crown.
wing|A bird uses this to fly.
catch|Grab a ball that someone throws to you.
match|Two things that look the same are a ___.
patch|A piece of cloth used to cover a hole.''')
group('2-early-direct','2',3,'08-03','Unit 1: Working Together','High-frequency words and community vocabulary','source-listed','''do|What should we ___ next?
that|___ is your bag over there.
the|Please open ___ window.
to|We went ___ the park.
you|I am talking to ___.
citizen|A person who belongs to a country or community.||academic
community|People who live in the same area.||academic
cooperate|Work together to get something done.||academic
volunteer|Someone who offers to help without being paid.||academic
belong|To be part of a group.''')
group('2-earlier-skills','2',3,'08-17','Unit 1: Working Together','Beginning and ending digraphs','skill-practice','''ship|A large boat for people or cargo.|ship
chop|Cut into smaller pieces.
shop|A place where people buy things.
fish|An animal with fins that lives in water.
wish|Something you hope will happen.
math|The subject in which we work with numbers.''')
group('2-final-e','2',3,'09-21','Unit 2: Inspiration and Painting','Final e: a_e, i_e, o_e, u_e','skill-practice','''cake|A sweet birthday treat with frosting.|cake
bike|A vehicle with two wheels that you pedal.
kite|A toy that flies in the wind on a string.
rope|A thick cord used to tie things.
cube|A solid shape with six equal square faces.
name|The word people use to call you.
game|An activity with rules that people play.
note|A short written message.''')
group('2-previous-direct','2',3,'09-28','Unit 2: Inspiration and Painting','High-frequency words: come, large, once, some','source-listed','''come|Please ___ here and sit by me.
large|Another word for big.
once|One time.
some|I ate ___ of the berries, but not all.''')
group('2-current-direct','2',3,'10-05','Unit 2: Inspiration and Painting','High-frequency words: could, have, through, would','source-listed','''could|When I was younger, I ___ not reach the shelf.
have|We ___ enough crayons for everyone.
through|We walked ___ the tunnel and out the other side.
would|I ___ like a glass of water, please.''')
group('2-current-practice','2',3,'10-05','Unit 2: Inspiration and Painting','Three-letter blends str, spl, spr, scr, shr, thr','skill-practice','''string|A thin cord used to tie things.
strip|A long, narrow piece of paper.
splash|Water sprays out when you jump into a puddle.
split|Divide into two parts.
sprig|A small stem with leaves on it.
scrap|A small leftover piece of material.
shrub|A woody plant smaller than a tree.
shrimp|A small sea animal with a curved body and many legs.''')
group('3-tradition','3',4,'08-03','Unit 1: Spinning Stories','Vocabulary notebook: Traditional, Myth, Fable, Folktale','source-listed','''traditional|Passed down from one generation to the next.
myth|An old story that may explain nature using gods or heroes.
fable|A short story, often with animals, that teaches a lesson.
folktale|A story passed down by people over time.''')
group('3-word-parts','3',4,'08-10','Unit 1: Spinning Stories','Vocabulary notebook: recount, moral, synonym, antonym, prefix, suffix','source-listed','''recount|Tell events again in the order they happened.
beginning|The first part of a story.
middle|The part between the start and the end.
end|The last part of a story.
moral|The lesson a story teaches.
synonym|A word with a meaning similar to another word.
antonym|A word with the opposite meaning of another word.
prefix|A word part added before a base word.
suffix|A word part added after a base word.''')
group('3-narrative','3',4,'08-24','Unit 1: Spinning Stories','Vocabulary notebook: plot, motivation, consequences, dialogue','source-listed','''plot|The events that happen in a story.
motivation|The reason a character acts a certain way.
consequences|Results that follow an action.
dialogue|The words characters say to each other.
quotations|Words copied exactly from what someone said or wrote.''')
group('3-geography','3',9,'08-31','United States Geography','Equator, latitude and longitude','source-listed','''equator|An imaginary line halfway between the North and South Poles.
latitude|How far north or south a place is from the equator.
longitude|How far east or west a place is from the prime meridian.''')
group('3-science','3',8,'08-10','Rocks, Soils and Fossils','Physical characteristics: hardness, color, luster, streak','source-listed','''hardness|How well a mineral resists being scratched.
color|The way something looks, such as red or blue.
luster|The way light reflects from a mineral surface.
streak|The color of the powder a mineral leaves when rubbed on a special tile.''')
group('3-information','3',4,'09-14','Unit 2: Into the Deep','Vocabulary notebook: Fact and Opinion','source-listed','''fact|A statement that can be checked and shown to be true.
opinion|What a person thinks or believes about something.''')
group('3-features','3',4,'10-05','Unit 2: Into the Deep','Text features, figurative language and main idea','skill-practice','''heading|A title above a section of text.
caption|Words beside a picture that explain it.
glossary|A list that explains special words in a book.
index|An alphabetical list that tells where topics appear in a book.
diagram|A drawing that explains how something works.
summary|A short retelling of the most important information.
compare|Tell how two things are alike.
contrast|Tell how two things are different.
simile|A comparison using like or as.
metaphor|A comparison that says one thing is another.
detail|A small piece of information that supports a bigger idea.
topic|What a text is mostly about.''')
group('3-current-listed','3',4,'10-05','Unit 2: Into the Deep','Precise language example: Sad to Disappointed','source-listed','''disappointed|Feeling let down when something hoped for does not happen.''')
group('4-early','4',5,'08-03','Unit 1: Keystone Species','Evidence, topic, sequence and context clues','skill-practice','''evidence|Information that supports an explanation or claim.
topic|The subject a text is about.
sequence|The order in which events happen.
context|The surrounding words that help explain an unfamiliar word.
scientific|Related to studying the natural world through observation and testing.
concept|A general idea.''')
group('4-story','4',5,'09-21','Unit 2: Storytellers','Plot events and narrative structure','skill-practice','''narrative|A text that tells a story.
conflict|A problem or struggle in a story.
resolution|The part where a story problem is settled.
character|A person or animal who takes part in a story.
setting|Where and when a story takes place.
climax|The turning point at the most exciting part of a story.''')
group('4-science','4',10,'09-21','Unit 2: Stars, Planets, and Moon','Earth and Moon movement, seasons, and models','skill-practice','''orbit|The path an object follows around another object in space.
rotation|The spinning of an object on its axis.
revolution|One trip of a planet around the Sun.
planet|A large round object that travels around a star.
phase|One of the changing shapes of the Moon that we see.
axis|An imaginary line an object spins around.
model|A representation used to explain an object or process.
season|One of the four parts of the year such as summer or winter.''')
group('4-parts','4',5,'10-05','Unit 2: Storytellers','Word parts pre-, post-, mid-','skill-practice','''preview|Look at something before seeing or doing all of it.
preheat|Warm an oven before cooking.
preschool|A school program for children before kindergarten.
prepay|Pay before receiving something.
pretest|A check of what you know before a lesson.
postwar|Happening after a war.
postgame|Happening after a game.
postdate|Write a later date on a document.
midday|The middle of the day.
midweek|The middle of the week.
midpoint|A point halfway between two ends.
midyear|The middle of a year.''')
group('4-civics','4',11,'10-05','Unit 3: Challenges of a New Nation','Representative democracy and the right to govern','skill-practice','''democracy|A system in which people have a voice in their government.
representative|A person chosen to speak or act for others.
govern|Make and carry out decisions for a community or country.
constitution|A written plan for how a government works.
rights|Freedoms and protections that people have.
citizen|A person who belongs to a country.
vote|Make a choice in an election.
law|A rule made and enforced by a government.''')
group('5-literacy','5',6,'08-10','Unit 1: Unlocking Confidence','Narrative techniques, characters, setting, plot and theme','skill-practice','''narrative|A text that tells a story.
character|A person or animal who takes part in a story.
setting|Where and when a story happens.
plot|The connected events in a story.
theme|A message about life developed through a story.
inference|An idea formed by combining clues with what you know.
simile|A comparison that uses like or as.
metaphor|A comparison that describes one thing as another.''')
group('5-earth','5',7,'08-10','Unit 1: Earth Science','Weathering, erosion and deposition','source-listed','''weathering|The breaking down of rock into smaller pieces.
erosion|The movement of rock or soil by water, wind, ice, or gravity.
deposition|The dropping of sediment in a new place.''')
group('5-earth-practice','5',7,'08-17','Unit 1: Earth Science','Surface features and landforms','skill-practice','''sediment|Small pieces of rock or soil carried and dropped by water, wind, or ice.
landform|A natural feature of the surface of Earth.
canyon|A deep valley with steep sides.
delta|Land built from sediment where a river enters a larger body of water.''')
group('5-civics','5',12,'08-31','Unit 2: Citizenship, Business, and Government','Rights, responsibilities, due process and constitution','skill-practice','''citizenship|Membership in a country with rights and responsibilities.
responsibility|A duty you are expected to carry out.
constitution|A written plan for a government.
amendment|A formal change or addition to a document.
government|The people and systems that make and carry out public decisions.
economy|The way people produce, buy, and sell goods and services.''')
group('5-physical','5',7,'09-28','Unit 2: Physical and Chemical Changes','Physical changes and states of water','skill-practice','''mixture|Two or more materials put together while keeping their own properties.
solid|Matter that keeps its own shape and volume.
liquid|Matter that flows and takes the shape of its container.
gas|Matter that spreads out to fill its container.
melting|The change from a solid to a liquid.
freezing|The change from a liquid to a solid.
evaporation|The change from a liquid into a gas at its surface.
condensation|The change from a gas into a liquid.''')
group('5-current-literacy','5',6,'10-05','Unit 2: From Earth to Mars','Facts, details, nonfiction and information from multiple sources','skill-practice','''nonfiction|Writing that gives information about real people, events, or ideas.
evidence|Information used to support an explanation or claim.
source|A place from which information comes.
summary|A brief account of the most important information.
explain|Make an idea clear by giving reasons or details.
support|Back up an idea with facts or examples.
analyze|Examine parts closely to understand how they work together.
research|Careful study to find information about a topic.''')
group('5-current-social','5',12,'10-05','Unit 3: The Changing Nation','The Cattle Trails','skill-practice','''cattle|Farm animals raised for meat or milk, including cows.
trail|A path used for travel across land.
herd|A group of grazing animals that live or move together.
ranch|A large farm where animals such as cattle are raised.''')
group('5-future-electricity','5',7,'11-09','Unit 3: Energy Transfer','Electricity and magnetism','skill-practice','''conductor|A material that allows electric current to flow through it.
insulator|A material that resists the flow of electric current.''')
# Pair concrete spelling words with the same reviewed local illustrations.
picture_ids=set(json.loads((ROOT/'src/data/spelling-bee-pictures.json').read_text()))
for word in bank:
    if word['word'] in picture_ids: word['picture']=word['word']
# Expanded general practice is a separately labeled option, never selected by pacing modes.
# Preserve all original sample illustrations/clues, supplement with editorial practice copies.
legacy=json.loads((ROOT/'src/data/spelling-bee.json').read_text())
general=[]
for grade in ['K','1','2','3','4','5']:
    originals=[] if grade=='K' else [w for w in legacy if w['grade']==grade]
    seen=set()
    for item in originals+[w for w in bank if w['grade']==grade and w['curriculum']['timing']=='documented' and w['curriculum']['earliestEligible']<='2026-10-09']:
        if item['word'] in seen: continue
        seen.add(item['word']); w=dict(item)
        w.update(id=f'general-{grade}-{w["word"]}',kind='sample',source='ClassThread general practice — not verified district vocabulary')
        w.pop('curriculum',None);w.pop('evidenceId',None)
        general.append(w)
for filename,data in [('src/data/spelling-bee-pacing.json',bank),('src/data/spelling-bee-general.json',general),('content/spelling-bee/evidence.json',evidence)]:
    (ROOT/filename).write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
print('Curriculum counts as of 2026-10-09')
for grade in ['K','1','2','3','4','5']:
    rows=[w for w in bank if w['grade']==grade and w['curriculum']['timing']=='documented' and w['curriculum']['earliestEligible']<='2026-10-09']
    print(grade,len(rows),dict(collections.Counter(w['curriculum']['category'] for w in rows)),'general',sum(w['grade']==grade for w in general))
