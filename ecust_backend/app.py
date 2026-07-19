import json, os
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from importer import DB, conn, env, init
env(); init()
app=FastAPI(title='ECUST Local Campus OS',version='0.1.0')
app.add_middleware(CORSMiddleware,allow_origins=['http://localhost:4321','http://127.0.0.1:4321','https://disdorqin.cn'],allow_methods=['*'],allow_headers=['*'])
def rows(sql,args=()):
 with conn(DB) as c:
  with c.cursor() as q: q.execute(sql,args); return q.fetchall()
@app.get('/api/health')
def health(): return {'ok':True,'database':DB}
@app.get('/api/dashboard')
def dashboard():
 def latest(kind,limit=1):
  data=rows('SELECT title,url,payload,last_seen FROM ecust_records WHERE kind=%s ORDER BY last_seen DESC LIMIT %s',(kind,limit))
  for r in data: r['payload']=json.loads(r['payload']) if isinstance(r['payload'],str) else r['payload']
  return data
 return {'notices':latest('notice',8),'grades':latest('grades',1),'timetable':latest('timetable',1),'program':latest('program',1),'synced':rows('SELECT imported_at,records_written,status FROM ecust_sync_runs ORDER BY id DESC LIMIT 1')}
class Ask(BaseModel): question:str
@app.post('/api/ask')
def ask(body:Ask):
 q=body.question.strip()
 if not q: raise HTTPException(400,'question is required')
 token=next((x for x in q.replace('？',' ').replace('?',' ').split() if len(x)>1),q[:12]); like='%'+token+'%'
 docs=rows('SELECT kind,title,url,payload,last_seen FROM ecust_records WHERE title LIKE %s OR CAST(payload AS CHAR) LIKE %s ORDER BY last_seen DESC LIMIT 12',(like,like))
 if not docs: docs=rows('SELECT kind,title,url,payload,last_seen FROM ecust_records ORDER BY last_seen DESC LIMIT 12')
 context=[]
 for d in docs:
  d['payload']=d['payload'] if isinstance(d['payload'],dict) else json.loads(d['payload']); context.append(d)
 key=os.getenv('DEEPSEEK_API_KEY','')
 if not key: return {'answer':'数据库已检索，但未配置 DEEPSEEK_API_KEY。','sources':context}
 prompt='你是 ECUST Personal Agent。只能依据以下本地校园数据回答；没有数据就说明。中文简洁回答并列出数据来源。\n数据：\n'+json.dumps(context,ensure_ascii=False,default=str)+'\n问题：'+q
 r=requests.post(os.getenv('DEEPSEEK_BASE_URL','https://api.deepseek.com').rstrip('/')+'/chat/completions',headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'},json={'model':'deepseek-chat','messages':[{'role':'system','content':'你是严谨的个人校园数据助理。'},{'role':'user','content':prompt}],'temperature':0.2},timeout=45)
 if not r.ok: raise HTTPException(502,'LLM request failed')
 return {'answer':r.json()['choices'][0]['message']['content'],'sources':context}
