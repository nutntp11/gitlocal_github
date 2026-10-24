/**
 * Swipe (swipe actions) — ปัดแถวในรายการไปทางซ้ายเพื่อโชว์ปุ่ม เช่น เก็บถาวร / ลบ
 *
 * - ปัดสั้น → ค้างเปิดโชว์ปุ่ม  ·  ปัดยาวเกิน fullSwipeRatio → ทำปุ่มสุดท้ายทันที (เหมือนแอป Mail)
 * - เลื่อนขึ้นลงได้ตามปกติ (ล็อกแกนหลังขยับ 8px)
 * - เปิดแถวใหม่ แถวอื่นที่เปิดค้างจะปิดเอง · แตะแถวที่เปิดอยู่ = ปิด
 *
 * ต้องการ: แถวมีพื้นหลังทึบ (ตัวโมดูลจะห่อเนื้อหาเดิมไว้ใน div ที่ inherit พื้นหลังนั้น)
 *
 *   const row = Gestures.swipeActions(rowEl, {
 *     actions: [
 *       { label: 'เก็บ', color: '#8e8e93', onAction(rowEl, close) { close(); } },
 *       { label: 'ลบ',  color: '#ff3b30', onAction(rowEl) { rowEl.remove(); } },
 *     ],
 *     actionWidth: 74,
 *     fullSwipe: true,
 *   });
 *   row.open(); row.close(); row.destroy();
 */
(function (root) {
  'use strict';

  const openRows = new Set();
  const EASE = 'cubic-bezier(.2,.8,.2,1)';

  function swipeActions(row, opts) {
    const o = Object.assign(
      { actions: [], actionWidth: 74, fullSwipe: true, fullSwipeRatio: 0.6, onOpen: null, onClose: null },
      opts
    );

    const content = document.createElement('div');
    content.style.cssText = 'position:relative;z-index:1;background:inherit;will-change:transform;';
    while (row.firstChild) content.appendChild(row.firstChild);

    const tray = document.createElement('div');
    tray.style.cssText = 'position:absolute;top:0;right:0;bottom:0;display:flex;overflow:hidden;width:0;';
    const buttons = o.actions.map((a, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = a.label;
      b.style.cssText =
        'flex:1 1 0;min-width:0;border:0;margin:0;padding:0 8px;color:#fff;font:inherit;font-weight:600;' +
        'cursor:pointer;white-space:nowrap;overflow:hidden;transition:flex-grow .2s ' + EASE + ';' +
        'background:' + (a.color || '#8e8e93');
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        run(i, false);
      });
      tray.appendChild(b);
      return b;
    });

    if (getComputedStyle(row).position === 'static') row.style.position = 'relative';
    row.style.overflow = 'hidden';
    row.style.touchAction = 'pan-y';
    row.append(tray, content);

    const maxOpen = o.actions.length * o.actionWidth;
    let offset = 0;
    let drag = null;
    let armed = false;
    let justDragged = false;

    function setOffset(x, animate) {
      offset = x;
      const t = animate ? '.3s ' + EASE : 'none';
      content.style.transition = 'transform ' + t;
      tray.style.transition = 'width ' + t;
      content.style.transform = 'translateX(' + x + 'px)';
      tray.style.width = Math.max(0, -x) + 'px';
    }

    function setArmed(on) {
      if (on === armed) return;
      armed = on;
      if (on && navigator.vibrate) navigator.vibrate(8);
      buttons.forEach((b, i) => {
        b.style.flexGrow = on ? (i === buttons.length - 1 ? '1' : '0') : '1';
      });
    }

    function open() {
      openRows.forEach((r) => r !== api && r.close());
      openRows.add(api);
      setOffset(-maxOpen, true);
      if (o.onOpen) o.onOpen(row);
    }

    function close() {
      openRows.delete(api);
      setArmed(false);
      setOffset(0, true);
      if (o.onClose) o.onClose(row);
    }

    function run(i, full) {
      const a = o.actions[i];
      if (full) setOffset(-row.offsetWidth, true);
      if (a && a.onAction) a.onAction(row, close);
    }

    function down(e) {
      if (e.button > 0) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, base: offset, axis: null, t: e.timeStamp, vx: 0 };
    }

    function move(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (drag.axis === 'y') return;
        row.setPointerCapture(e.pointerId);
        openRows.forEach((r) => r !== api && r.close());
      }
      if (drag.axis !== 'x') return;

      const dt = Math.max(1, e.timeStamp - drag.t);
      drag.vx = (e.clientX - (drag.lastX ?? drag.x)) / dt;
      drag.lastX = e.clientX;
      drag.t = e.timeStamp;

      let x = drag.base + dx;
      if (x > 0) x = x / 4; // ยางยืดเมื่อปัดผิดทาง
      if (!o.fullSwipe && x < -maxOpen) x = -maxOpen + (x + maxOpen) / 4;
      setOffset(x, false);
      setArmed(o.fullSwipe && -x > row.offsetWidth * o.fullSwipeRatio);
    }

    function up(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const wasX = drag.axis === 'x';
      const vx = drag.vx;
      drag = null;
      if (!wasX) return;
      justDragged = true;
      setTimeout(() => (justDragged = false), 0);

      if (armed) return run(o.actions.length - 1, true);
      if (vx < -0.4 || (-offset > maxOpen / 2 && vx < 0.4)) open();
      else close();
    }

    function contentClick(e) {
      if (justDragged || offset !== 0) {
        e.preventDefault();
        e.stopPropagation();
        if (!justDragged) close();
      }
    }

    row.addEventListener('pointerdown', down);
    row.addEventListener('pointermove', move);
    row.addEventListener('pointerup', up);
    row.addEventListener('pointercancel', up);
    content.addEventListener('click', contentClick, true);

    const api = {
      open,
      close,
      destroy() {
        openRows.delete(api);
        row.removeEventListener('pointerdown', down);
        row.removeEventListener('pointermove', move);
        row.removeEventListener('pointerup', up);
        row.removeEventListener('pointercancel', up);
        tray.remove();
        while (content.firstChild) row.appendChild(content.firstChild);
        content.remove();
      },
    };
    return api;
  }

  (root.Gestures = root.Gestures || {}).swipeActions = swipeActions;
  if (typeof module === 'object' && module.exports) module.exports = swipeActions;
})(typeof window !== 'undefined' ? window : globalThis);
