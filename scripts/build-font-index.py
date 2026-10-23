"""Build an original ASCII glyph index from individually OFL-verified Google Fonts.
Network access is build-time only. Runtime assets are self-hosted. Requires fonttools, brotli, Pillow.
Run python scripts/build-font-index.py. Cached source data is ignored by git.
"""
from pathlib import Path
import urllib.request,json,re,concurrent.futures,io,gzip,struct,time,hashlib
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter,Options
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image,ImageFont,ImageDraw
ROOT=Path(__file__).resolve().parent.parent
cache=ROOT/'.font-build';cache.mkdir(exist_ok=True)
out=ROOT/'public/font-index';out.mkdir(exist_ok=True)
def fetch(url):
 for attempt in range(3):
  try:return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'KittySuite font index builder'}),timeout=30).read()
  except Exception:
   if attempt==2:raise
   time.sleep(attempt+1)
meta=cache/'metadata.json'
if not meta.exists():meta.write_bytes(fetch('https://fonts.google.com/metadata/fonts'))
families=json.loads(meta.read_text(encoding='utf-8'))['familyMetadataList']
families=[f for f in families if 'latin' in f['subsets'] and '400' in f['fonts'] and f.get('isOpenSource')]
priority=['Inconsolata','Oswald','Lato','Manrope','Libre Baskerville','Dancing Script']
families.sort(key=lambda f:(priority.index(f['family']) if f['family'] in priority else 10,f.get('popularity',9999)))
chars=''.join(chr(i) for i in range(33,127))
def build(family):
 name=family['family'];slug=re.sub('[^a-z0-9]','',name.lower());record=cache/(slug+'.json');features=cache/(slug+'.bin')
 if record.exists() and features.exists():return json.loads(record.read_text(encoding='utf-8')),features.read_bytes()
 try:
  base='https://raw.githubusercontent.com/google/fonts/main/ofl/'+slug+'/'
  metadata=fetch(base+'METADATA.pb').decode();license=fetch(base+'OFL.txt')
  if b'SIL OPEN FONT LICENSE' not in license.upper():return None
  blocks=re.findall(r'fonts\s*\{(.*?)\}',metadata,re.S)
  regular=[b for b in blocks if 'style: "normal"' in b and 'weight: 400' in b]
  if not regular:return None
  filename=re.search(r'filename: "([^"]+)"',regular[0]).group(1)
  raw=fetch(base+urllib.parse.quote(filename));font=TTFont(io.BytesIO(raw))
  cmap=font.getBestCmap()
  if any(ord(c) not in cmap for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'):return None
  if 'fvar' in font:
   axes={a.axisTag:(400 if a.axisTag=='wght' else a.defaultValue) for a in font['fvar'].axes}
   font=instantiateVariableFont(font,axes,inplace=True)
  opts=Options();subset=Subsetter(options=opts);subset.populate(unicodes=range(32,592));subset.subset(font)
  font.flavor=None;ttf=io.BytesIO();font.save(ttf)
  face=ImageFont.truetype(io.BytesIO(ttf.getvalue()),80)
  data=bytearray()
  for c in chars:
   box=face.getbbox(c);w=max(1,box[2]-box[0]);h=max(1,box[3]-box[1]);img=Image.new('L',(w,h));ImageDraw.Draw(img).text((-box[0],-box[1]),c,font=face,fill=255)
   ink=img.getbbox()
   if ink:img=img.crop(ink)
   data.extend(img.resize((12,16),Image.Resampling.BOX).tobytes());data.extend(struct.pack('<ff',img.width/img.height,face.getlength(c)/80))
  familyName='KittySuite Index '+slug
  names={1:familyName,2:'Regular',3:'KittySuiteIndex-'+slug,4:familyName+' Regular',6:'KittySuiteIndex-'+slug,16:familyName,17:'Regular'}
  for recordName in font['name'].names:
   if recordName.nameID in names:recordName.string=names[recordName.nameID].encode(recordName.getEncoding(),errors='replace')
  font.flavor='woff2';font.save(out/(slug+'.woff2'));(out/(slug+'-OFL.txt')).write_bytes(license)
  result={'name':name,'id':slug,'url':'/font-index/'+slug+'.woff2','license':'/font-index/'+slug+'-OFL.txt','source':'https://fonts.google.com/specimen/'+urllib.parse.quote(name),'licenseName':'SIL Open Font License','weightRange':'400'}
  record.write_text(json.dumps(result),encoding='utf-8');features.write_bytes(data)
  return result,bytes(data)
 except Exception as e:
  print('skip',slug,str(e)[:100],flush=True);return None
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
 for result in pool.map(build,families[:1450]):
  if result:results.append(result)
  if len(results) and len(results)%100==0:print('indexed',len(results),flush=True)
for record,data in results: record['sha256']=hashlib.sha256((ROOT/'public'/record['url'].lstrip('/')).read_bytes()).hexdigest()
manifest={'version':1,'characters':chars,'stride':200,'fonts':[r[0] for r in results]}
(out/'manifest.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
data=bytearray(b''.join(r[1] for r in results))
for offset in range(0,len(data),200):
 for i in range(192):data[offset+i]=round(data[offset+i]/17)*17
(out/'glyphs.bin.gz').write_bytes(gzip.compress(data,compresslevel=9,mtime=0))
print('COMPLETE',len(results),'families; compressed index bytes',(out/'glyphs.bin.gz').stat().st_size,flush=True)
if len(results)<1000:raise SystemExit('Need at least 1000 licensed families')
