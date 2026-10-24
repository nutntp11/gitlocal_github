# iOS Gestures — 9 ท่า พร้อมใช้

Prototype ของ 9 ท่าทางสัมผัสแบบ iOS เปิด `index.html` แล้วลองเล่นได้ทันที (ใช้นิ้วบนมือถือ หรือเมาส์บนคอม)
แต่ละท่าเป็น **ไฟล์ JS ไฟล์เดียว ไม่พึ่ง library** อยู่ใน `gestures/` เลือกเฉพาะท่าที่ต้องการไปใช้ในโปรเจกต์ไหนก็ได้

| ท่า | ไฟล์ | เรียกใช้ | ใช้ทำอะไร |
|---|---|---|---|
| Tap | `gestures/tap.js` | `Gestures.tap(el, { onTap })` | แตะเปิด โดยไม่นับตอนนิ้วลาก/เลื่อนจอ |
| Double tap | `gestures/double-tap.js` | `Gestures.doubleTap(el, { onDoubleTap, onSingleTap })` | ถูกใจรูป, ซูมเข้า/ออก |
| Touch and hold | `gestures/long-press.js` | `Gestures.longPress(el, { onLongPress })` | เมนูลัด / context menu (คลิกขวาก็ได้) |
| Swipe | `gestures/swipe-actions.js` | `Gestures.swipeActions(row, { actions })` | ปัดแถวโชว์ปุ่ม เก็บ/ลบ · ปัดยาว = ลบทันที |
| Drag | `gestures/drag-reorder.js` | `Gestures.dragReorder(list, { onReorder })` | ลากเรียงลำดับ (เช่น ลำดับร้านในเส้นทาง) |
| Pinch | `gestures/pinch-zoom.js` | `Gestures.pinchZoom(viewport, { onChange })` | ซูมรูป/แผนที่/กราฟ · Ctrl+scroll · แตะสองครั้ง |
| Pull to refresh | `gestures/pull-to-refresh.js` | `Gestures.pullToRefresh(scroller, { onRefresh })` | ดึงลงโหลดข้อมูลใหม่ (รองรับ async) |
| Edge swipe | `gestures/edge-swipe.js` | `Gestures.edgeSwipe(screen, { page, under, onBack })` | ปัดจากขอบซ้ายเพื่อย้อนกลับ |
| Swipe to dismiss | `gestures/swipe-to-dismiss.js` | `Gestures.swipeToDismiss(sheet, { backdrop, onDismiss })` | ปัดลงปิด bottom sheet / modal |

ตัวเลือกทั้งหมดของแต่ละท่าเขียนไว้ที่หัวไฟล์นั้นๆ ทุกตัวคืนค่า object ที่มี `destroy()` (บางตัวมี `open/close/reset/refresh` เพิ่ม)

## วิธีใช้ในโปรเจกต์

```html
<script src="gestures/swipe-actions.js"></script>
<script>
  Gestures.swipeActions(document.querySelector('.row'), {
    actions: [{ label: 'ลบ', color: '#ff3b30', onAction(row) { row.remove(); } }],
  });
</script>
```

- ใช้กับไฟล์ HTML ที่เปิดแบบ `file://` ได้ (ไม่ใช่ ES module) — เหมาะกับ dashboard แบบ static HTML
- จะฝังลงไฟล์เดียว (inline) ก็ได้ — ถ้าใช้ `.replace()` แทรกโค้ด ให้ใช้ function replacer `() => code` เสมอ
- Node/bundler: `const swipeActions = require('./gestures/swipe-actions.js')`

## สั่ง AI ให้ได้ท่าตรงตัว (vocabulary for agentic coding)

| ท่า | ประโยคที่ใช้สั่ง |
|---|---|
| Tap | Tap an app icon to open it, with a press-down feedback. |
| Double tap | Double-tap the photo to like it, with a heart burst where I tapped. |
| Touch and hold | Touch and hold a message to show reactions and a context menu, with the background blurred. |
| Swipe | Swipe a row left to reveal Archive and Delete; a full swipe deletes it. |
| Drag | Drag the handle to reorder list items; other rows slide out of the way. |
| Pinch | Pinch to zoom the photo around my fingers, pan when zoomed, and spring back at the edges. |
| Pull to refresh | Pull down from the top of the list to refresh, with a spinner until new items load. |
| Edge swipe | Swipe from the left edge to go back, with the previous page sliding in underneath. |
| Swipe to dismiss | Swipe the bottom sheet down to dismiss it; the backdrop fades as I drag. |

## ถ้าทำแอป iOS จริง (SwiftUI)

| ท่า | SwiftUI |
|---|---|
| Tap | `.onTapGesture { }` |
| Double tap | `.onTapGesture(count: 2) { }` |
| Touch and hold | `.contextMenu { }` หรือ `.onLongPressGesture { }` |
| Swipe | `.swipeActions(edge: .trailing, allowsFullSwipe: true) { }` |
| Drag | `List { ForEach … .onMove { } }` |
| Pinch | `MagnifyGesture()` |
| Pull to refresh | `.refreshable { await … }` |
| Edge swipe | ได้ฟรีจาก `NavigationStack` |
| Swipe to dismiss | `.sheet(isPresented:)` + `.presentationDetents([.medium, .large])` |

## ข้อควรรู้

- Safari บน iPhone ใช้ปัดขอบซ้ายเป็นปุ่มย้อนกลับของเบราว์เซอร์ — Edge swipe จะไม่ชนก็ต่อเมื่อเปิดเป็น web app เต็มจอ (Add to Home Screen) หรือใน WebView
- Pull to refresh กับ Swipe to dismiss ใช้ touch event (ไม่ใช่ pointer) เพื่อกันเบราว์เซอร์แย่งไปเลื่อนหน้า
- รายการยาวที่ต้องเลื่อนด้วยนิ้ว ควรมีด้ามจับ (`data-drag-handle`) ให้ Drag ไม่งั้นนิ้วจะลากแถวแทนการเลื่อนจอ
- CSS ของหน้า ต้องมี `[hidden] { display: none !important; }` ถ้า element ที่ซ่อนมี `display` ของตัวเอง (เช่น sheet ที่เป็น flex)

## ทดสอบ

```bash
node tests/run.js          # ทดสอบ 16 กรณีใน Chromium (ต้องมี playwright)
node tests/run.js --shot   # + เซฟภาพหน้าจอ tests/screenshot.png
```
