"""Interactive local synchronizer. First run opens a persistent browser; login through SSLVPN yourself."""
import sys
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
from importer import DB, conn, env, init, rows_from_html, sha, upsert

env(); init()
BASE='https://inquiry-ecust-edu-cn-s.sslvpn.ecust.edu.cn:8118/jsxsd/'
TARGETS={
  'grades': 'xsxj/xjxxgl.do?Ves632DSdyV=NEW_XSD_XJCJ',
  'timetable': 'xskb/xskb_list.do',
  'program': 'pyfa/pyfa_query?Ves632DSdyV=NEW_XSD_PYGL',
}

def save(kind, url, body):
  with conn(DB) as c:
    upsert(c,kind,'inquiry-live',sha(url),'实时同步：'+kind,url,{'rows':rows_from_html(body),'captured_at':datetime.now().isoformat()})

def main():
  profile=Path(__file__).parent/'browser_profile'
  with sync_playwright() as p:
    browser=p.chromium.launch_persistent_context(str(profile),headless=False,viewport={'width':1440,'height':900})
    page=browser.pages[0] if browser.pages else browser.new_page()
    page.goto(BASE,wait_until='domcontentloaded')
    print('请在打开的浏览器中完成 SSLVPN/教务登录；完成后回到终端按 Enter。')
    input()
    for kind,path in TARGETS.items():
      url=BASE+path
      page.goto(url,wait_until='networkidle',timeout=60000)
      save(kind,url,page.content())
      print('synced',kind)
    print('同步完成。浏览器资料目录已保存在本地，下次会复用会话。')
    browser.close()
if __name__=='__main__': main()
