"""Interactive local synchronizer. First run opens a persistent browser; login through SSLVPN yourself."""
import sys
from datetime import datetime
from pathlib import Path
from playwright.sync_api import Error as PlaywrightError, TimeoutError as PlaywrightTimeoutError, sync_playwright
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

def capture(page, kind, message):
  print(message)
  input('页面确认后按 Enter 保存当前页面：')
  try:
    page.wait_for_load_state('networkidle', timeout=30000)
  except PlaywrightTimeoutError:
    page.wait_for_load_state('domcontentloaded', timeout=30000)
  last_error=None
  for _ in range(6):
    try:
      page.wait_for_timeout(1200)
      url=page.url
      body=page.content()
      save(kind,url,body)
      print('synced',kind,url)
      return
    except PlaywrightError as error:
      last_error=error
  raise last_error

def main():
  profile=Path(__file__).parent/'browser_profile'
  with sync_playwright() as p:
    browser=p.chromium.launch_persistent_context(str(profile),headless=False,viewport={'width':1440,'height':900})
    page=browser.pages[0] if browser.pages else browser.new_page()
    page.goto(BASE,wait_until='domcontentloaded')
    print('请在打开的浏览器中完成 SSLVPN/教务登录；完成后回到终端按 Enter。')
    input()
    capture(page,'grades','现在请在浏览器点击：考务成绩 → 学生成绩 → 成绩查询。')
    capture(page,'timetable','现在请在浏览器点击：培养管理 → 课表查询，并切到当前学期。')
    page.goto(BASE+'pyfa/pyfa_query?Ves632DSdyV=NEW_XSD_PYGL',wait_until='networkidle',timeout=60000)
    save('program',page.url,page.content())
    print('synced program')
    print('同步完成。')
    browser.close()
if __name__=='__main__': main()
