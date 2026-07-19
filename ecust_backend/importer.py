import hashlib, html, json, os, re, sys
from datetime import datetime
from pathlib import Path
import pymysql
ROOT=Path(__file__).parent
def env():
 p=ROOT/'.env'
 if p.exists():
  for line in p.read_text(encoding='utf-8').splitlines():
   if '=' in line and not line.lstrip().startswith('#'):
    k,v=line.split('=',1); os.environ.setdefault(k.strip(),v.strip())
env()
CFG=dict(host=os.getenv('ECUST_DB_HOST','127.0.0.1'),port=int(os.getenv('ECUST_DB_PORT','3306')),user=os.getenv('ECUST_DB_USER','root'),password=os.getenv('ECUST_DB_PASSWORD',''),charset='utf8mb4',autocommit=True)
DB=os.getenv('ECUST_DB_NAME','ecust_twin')
def conn(db=None): return pymysql.connect(**CFG,database=db,cursorclass=pymysql.cursors.DictCursor)
def init():
 with conn() as c:
  with c.cursor() as q: q.execute(f'CREATE DATABASE IF NOT EXISTS `{DB}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
 with conn(DB) as c:
  with c.cursor() as q:
   q.execute('''CREATE TABLE IF NOT EXISTS ecust_records(id BIGINT AUTO_INCREMENT PRIMARY KEY,kind VARCHAR(32) NOT NULL,source VARCHAR(32) NOT NULL,external_id VARCHAR(255) NOT NULL,title TEXT,url TEXT,payload JSON NOT NULL,content_hash CHAR(64) NOT NULL,first_seen DATETIME NOT NULL,last_seen DATETIME NOT NULL,UNIQUE KEY ux_record(kind,source,external_id),KEY ix_kind(kind),KEY ix_seen(last_seen))''')
   q.execute('''CREATE TABLE IF NOT EXISTS ecust_sync_runs(id BIGINT AUTO_INCREMENT PRIMARY KEY,source VARCHAR(32),file_name TEXT,imported_at DATETIME,entries_total INT,records_written INT,status VARCHAR(32),detail TEXT)''')
def clean(s): return re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',html.unescape(s or ''))).strip()
def sha(v): return hashlib.sha256(v.encode('utf-8','ignore')).hexdigest()
def upsert(c,kind,source,eid,title,url,payload):
 now=datetime.now().strftime('%Y-%m-%d %H:%M:%S'); h=sha(json.dumps(payload,ensure_ascii=False,sort_keys=True))
 with c.cursor() as q: q.execute('''INSERT INTO ecust_records(kind,source,external_id,title,url,payload,content_hash,first_seen,last_seen) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s) ON DUPLICATE KEY UPDATE title=VALUES(title),url=VALUES(url),payload=VALUES(payload),content_hash=VALUES(content_hash),last_seen=VALUES(last_seen)''',(kind,source,eid,title,url,json.dumps(payload,ensure_ascii=False),h,now,now))
def rows_from_html(text):
 out=[]
 for tr in re.findall(r'<tr[^>]*>(.*?)</tr>',text or '',re.I|re.S):
  row=[clean(x) for x in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>',tr,re.I|re.S)]
  if len(row)>=2 and any(row): out.append(row)
 return out
def import_har(path):
 init(); h=json.loads(Path(path).read_text(encoding='utf-8')); entries=h.get('log',{}).get('entries',[]); n=0
 with conn(DB) as c:
  for e in entries:
   u=e.get('request',{}).get('url',''); text=e.get('response',{}).get('content',{}).get('text','') or ''; low=u.lower()
   if not text: continue
   if 'jwc-' in low and ('list.htm' in low or 'main.htm' in low):
    for href,label in re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',text,re.I|re.S):
     title=clean(label)
     if len(title)<8: continue
     full=href if href.startswith('http') else u.rsplit('/',1)[0]+'/'+href.lstrip('/'); upsert(c,'notice','jwc',sha(full),title,full,{'source_page':u}); n+=1
   elif 'xsxj/' in low: upsert(c,'grades','inquiry',sha(u),'成绩查询',u,{'rows':rows_from_html(text)}); n+=1
   elif any(x in low for x in ['/xskb/','/kbxx/']): upsert(c,'timetable','inquiry',sha(u),'课程表',u,{'rows':rows_from_html(text)}); n+=1
   elif '/pyfa/' in low: upsert(c,'program','inquiry',sha(u),'培养方案',u,{'rows':rows_from_html(text)}); n+=1
   elif 'teacherhome' in low: upsert(c,'teachers','faculty',sha(u+text[:1000]),'教师检索',u,{'rows':rows_from_html(text)}); n+=1
  with c.cursor() as q: q.execute('INSERT INTO ecust_sync_runs(source,file_name,imported_at,entries_total,records_written,status,detail) VALUES(%s,%s,NOW(),%s,%s,%s,%s)',('har',str(path),len(entries),n,'ok','local HAR import'))
 return {'entries':len(entries),'records_written':n}
if __name__=='__main__':
 if len(sys.argv)<2: raise SystemExit('usage: python importer.py <file.har>')
 print(json.dumps(import_har(sys.argv[1]),ensure_ascii=False,indent=2))
