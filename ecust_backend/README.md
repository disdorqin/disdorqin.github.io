# ECUST Local Campus OS

本地运行：连接 VPN 后导入 HAR。数据库和 API Key 只在 `.env`，不会提交 GitHub。

```powershell
cd ecust_backend
python -m pip install -r requirements.txt
python importer.py "D:\computer learning\spider\华东理工\inquiry-ecust-edu-cn-s.sslvpn.ecust.edu.cn.har"
uvicorn app:app --host 127.0.0.1 --port 8787
```

## 实时同步

连接 VPN 后执行：

```powershell
python live_sync.py
```

首次会弹出浏览器；在窗口内完成你的学校登录后回终端回车。会话仅保存在 `browser_profile/`，不会进入 Git。
