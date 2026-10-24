// ทดสอบทั้ง 9 ท่าบนหน้า index.html ด้วย Chromium (Playwright)
//   node tests/run.js            → รันทดสอบ
//   node tests/run.js --shot     → + บันทึกภาพหน้าจอ tests/screenshot.png
const path = require('path');
const { chromium } = require('playwright');

const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (err) {
    results.push(['FAIL', name + ' — ' + err.message]);
  }
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function drag(page, from, to, { steps = 12, hold = 0 } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  if (hold) await page.waitForTimeout(hold);
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

async function center(locator) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b };
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1180, height: 2400 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForTimeout(300);

  await check('Tap เปิดแอป แล้วแตะอีกครั้งกลับหน้าโฮม', async () => {
    const app = page.locator('#springboard .app').first();
    await app.scrollIntoViewIfNeeded();
    await app.click();
    await page.waitForTimeout(450);
    expect(await page.locator('#tap .launch').count() === 1, 'ไม่เห็นหน้าแอป');
    await page.locator('#tap .launch').click();
    await page.waitForTimeout(450);
    expect(await page.locator('#tap .launch').count() === 0, 'หน้าแอปไม่ปิด');
  });

  await check('Tap ไม่นับเมื่อลากเกิน 10px', async () => {
    const c = await center(page.locator('#springboard .app').nth(1));
    await drag(page, c, { x: c.x + 30, y: c.y });
    await page.waitForTimeout(100);
    expect(await page.locator('#tap .launch').count() === 0, 'ลากแล้วยังเปิดแอป');
  });

  await check('Double tap กดถูกใจ +1', async () => {
    const c = await center(page.locator('#photo'));
    await page.mouse.dblclick(c.x, c.y);
    await page.waitForTimeout(100);
    expect((await page.textContent('#like-count')) === '129', 'ยอดถูกใจไม่เพิ่ม');
    expect(await page.locator('#photo .burst').count() === 1, 'ไม่มีหัวใจเด้ง');
  });

  await check('Touch and hold เปิดเมนู แล้วลบข้อความได้', async () => {
    const before = await page.locator('#chat .bubble').count();
    const c = await center(page.locator('#chat .bubble').first());
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    expect(await page.locator('#touch-and-hold .ctx').count() === 1, 'เมนูไม่ขึ้น');
    await page.locator('#touch-and-hold .ctx [data-act="delete"]').click();
    expect((await page.locator('#chat .bubble').count()) === before - 1, 'ข้อความไม่ถูกลบ');
  });

  await check('Touch and hold กดสั้นไม่เปิดเมนู', async () => {
    await page.locator('#chat .bubble').first().click();
    await page.waitForTimeout(600);
    expect(await page.locator('#touch-and-hold .ctx').count() === 0, 'กดสั้นแล้วเมนูขึ้น');
  });

  await check('Swipe ปัดสั้นค้างเปิดปุ่ม · ปัดยาวลบแถว', async () => {
    const rows = page.locator('#mail .mail-row');
    const before = await rows.count();
    const c = await center(rows.nth(0));
    await drag(page, { x: c.x + 60, y: c.y }, { x: c.x - 60, y: c.y });
    await page.waitForTimeout(350);
    const w = await rows.nth(0).evaluate((r) => r.lastElementChild.style.transform);
    expect(w === 'translateX(-148px)', 'ปุ่มไม่ค้างเปิด: ' + w);
    const c2 = await center(rows.nth(1));
    await drag(page, { x: c2.box.x + c2.box.width - 10, y: c2.y }, { x: c2.box.x - 20, y: c2.y });
    await page.waitForTimeout(700);
    expect((await rows.count()) === before - 1, 'ปัดยาวแล้วแถวไม่หาย');
  });

  await check('Drag ลากแถวแรกลงไปลำดับ 3', async () => {
    const first = await page.locator('#todo li').first().locator('.t').textContent();
    const h = await center(page.locator('#todo li').first().locator('.handle'));
    const step = (await page.locator('#todo li').nth(1).boundingBox()).y - (await page.locator('#todo li').nth(0).boundingBox()).y;
    await drag(page, h, { x: h.x, y: h.y + step * 2 + 10 }, { steps: 20 });
    await page.waitForTimeout(350);
    const third = await page.locator('#todo li').nth(2).locator('.t').textContent();
    expect(third === first, 'ลำดับไม่เปลี่ยน');
    expect((await page.locator('#todo li').nth(2).locator('.n').textContent()) === '3', 'เลขลำดับไม่อัปเดต');
  });

  await check('Pinch สองนิ้วถ่างแล้วซูมเข้า · แตะสองครั้งกลับ 1×', async () => {
    const v = page.locator('#viewer');
    await v.scrollIntoViewIfNeeded();
    const c = await center(v);
    await page.evaluate(({ x, y }) => {
      const el = document.getElementById('viewer');
      const fire = (type, id, px) =>
        el.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: px, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1 }));
      el.setPointerCapture = () => {};
      fire('pointerdown', 1, x - 20);
      fire('pointerdown', 2, x + 20);
      for (let i = 1; i <= 10; i++) { fire('pointermove', 1, x - 20 - i * 6); fire('pointermove', 2, x + 20 + i * 6); }
      fire('pointerup', 1, x - 80);
      fire('pointerup', 2, x + 80);
    }, c);
    await page.waitForTimeout(400);
    const z = parseFloat(await page.textContent('#zoom-badge'));
    expect(z >= 3.5, 'scale = ' + z);
    await page.mouse.dblclick(c.x, c.y);
    await page.waitForTimeout(400);
    expect((await page.textContent('#zoom-badge')) === '1.0×', 'ไม่กลับ 1×');
  });

  await check('Pinch ด้วย Ctrl + scroll', async () => {
    const c = await center(page.locator('#viewer'));
    await page.mouse.move(c.x, c.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -60);
    await page.keyboard.up('Control');
    await page.waitForTimeout(100);
    expect(parseFloat(await page.textContent('#zoom-badge')) > 1.2, 'Ctrl+scroll ไม่ซูม');
  });

  await check('Pull to refresh ดึงลงแล้วมีรายการใหม่', async () => {
    const items = page.locator('#feed-list .feed-item');
    const before = await items.count();
    const c = await center(page.locator('#feed'));
    await drag(page, { x: c.x, y: c.box.y + 20 }, { x: c.x, y: c.box.y + 260 }, { steps: 20 });
    await page.waitForTimeout(1600);
    expect((await items.count()) === before + 1, 'ไม่มีรายการใหม่');
  });

  await check('Pull to refresh ดึงนิดเดียวไม่รีเฟรช', async () => {
    const items = page.locator('#feed-list .feed-item');
    const before = await items.count();
    const c = await center(page.locator('#feed'));
    await drag(page, { x: c.x, y: c.box.y + 20 }, { x: c.x, y: c.box.y + 60 }, { steps: 8 });
    await page.waitForTimeout(1500);
    expect((await items.count()) === before, 'ดึงนิดเดียวแล้วรีเฟรช');
  });

  await check('Edge swipe จากขอบซ้ายย้อนกลับ · กดแถวเปิดหน้าใหม่ได้', async () => {
    const s = await center(page.locator('#edge-swipe .screen'));
    await drag(page, { x: s.box.x + 6, y: s.y }, { x: s.box.x + 190, y: s.y }, { steps: 14 });
    await page.waitForTimeout(450);
    expect(await page.locator('#page-detail').isHidden(), 'ไม่ย้อนกลับ');
    await page.locator('#settings-list button').nth(2).click();
    await page.waitForTimeout(400);
    expect(await page.locator('#page-detail').isVisible(), 'ไม่เปิดหน้า detail');
  });

  await check('Edge swipe เริ่มกลางจอไม่ย้อนกลับ', async () => {
    const s = await center(page.locator('#edge-swipe .screen'));
    await drag(page, { x: s.box.x + 80, y: s.y }, { x: s.box.x + 220, y: s.y });
    await page.waitForTimeout(450);
    expect(await page.locator('#page-detail').isVisible(), 'ย้อนกลับทั้งที่ไม่ได้เริ่มที่ขอบ');
  });

  await check('Swipe to dismiss ปัดชีทลงแล้วปิด · เปิดใหม่ได้', async () => {
    const g = await center(page.locator('#sheet .grabber'));
    await drag(page, g, { x: g.x, y: g.y + 260 }, { steps: 14 });
    await page.waitForTimeout(450);
    expect(await page.locator('#sheet').isHidden(), 'ชีทไม่ปิด');
    expect(await page.locator('#reopen').isVisible(), 'ไม่มีปุ่มเปิดใหม่');
    await page.locator('#reopen').click();
    await page.waitForTimeout(400);
    expect(await page.locator('#sheet').isVisible(), 'เปิดชีทใหม่ไม่ได้');
  });

  await check('Swipe to dismiss ลากสั้นเด้งกลับ', async () => {
    const g = await center(page.locator('#sheet .grabber'));
    await drag(page, g, { x: g.x, y: g.y + 40 }, { steps: 20 });
    await page.waitForTimeout(450);
    expect(await page.locator('#sheet').isVisible(), 'ลากสั้นแล้วปิด');
  });

  await check('ไม่มี JavaScript error', async () => expect(!errors.length, errors.join(' | ')));

  if (process.argv.includes('--shot')) {
    await page.reload();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(__dirname, 'screenshot.png'), fullPage: true });
  }

  await browser.close();
  results.forEach(([s, n]) => console.log(s + '  ' + n));
  const failed = results.filter(([s]) => s === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} ผ่าน`);
  process.exit(failed ? 1 : 0);
})();
