import json,re,sys,os
from PIL import Image,ImageDraw
names=json.load(open('names.json')); specs=[l.strip() for l in open('app.txt') if l.strip()]
appdir,out=sys.argv[1],sys.argv[2]; os.makedirs(out,exist_ok=True)
W=300;H=650
def load(p):
  im=Image.open(p).convert('RGB'); return im.resize((W,int(im.height*W/im.width)))
pairs=[]
for n,s in zip(names,specs):
  fn=re.sub(r'[^a-z0-9]+','_',s,flags=re.I)[:80]+'.png'
  a=load(f'ref/{n}.png'); b=load(f'{appdir}/{fn}')
  c=Image.new('RGB',(W*2+15,H+20),'#888'); c.paste(a.crop((0,0,W,H)),(0,20)); c.paste(b.crop((0,0,W,H)),(W+15,20))
  d=ImageDraw.Draw(c); d.text((3,5),'DESIGN '+n,fill='white'); d.text((W+18,5),'APP '+s,fill='white'); pairs.append(c)
for i in range(0,len(pairs),4):
  sh=Image.new('RGB',(2*(W*2+15),2*(H+20)),'white')
  for j,p in enumerate(pairs[i:i+4]): sh.paste(p,((j%2)*(W*2+15),(j//2)*(H+20)))
  sh.save(f'{out}/cmp_{i//4:02d}.png')
print(len(pairs))
