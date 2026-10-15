# gitlocal_github

Global Claude skills ของ Nuttaphum: skill ที่ไม่ผูกกับโปรเจกต์ใด ใช้ได้ทุกที่

## Skills

| Skill | ทำอะไร |
|---|---|
| [`reverse-engineer-anything`](skills/reverse-engineer-anything/SKILL.md) | แกะ logic ของรายงาน, สูตร, dashboard, API, ไฟล์, process แล้ว rebuild ให้ตัวเลขตรงต้นฉบับ พร้อม diff พิสูจน์ (`scripts/reconcile.js`) |

## ติดตั้งเป็น global

**Claude Code (เครื่อง Windows):** copy โฟลเดอร์ skill ไปไว้ที่ `%USERPROFILE%\.claude\skills\`

```powershell
git clone https://github.com/nutntp11/gitlocal_github.git
xcopy /E /I gitlocal_github\skills\reverse-engineer-anything "%USERPROFILE%\.claude\skills\reverse-engineer-anything"
```

**Claude.ai / Cowork:** Settings → Capabilities → Skills → Upload skill → เลือก `dist/reverse-engineer-anything.zip`
