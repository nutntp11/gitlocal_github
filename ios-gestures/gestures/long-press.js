/**
 * Touch and hold (long press) — แตะค้าง เพื่อเปิดเมนูลัด / context menu
 *
 * - สั่นเบาๆ ตอนครบเวลา (ถ้าเครื่องรองรับ navigator.vibrate)
 * - บนคอมพิวเตอร์ คลิกขวา = long press ทันที (ปิดได้ด้วย contextMenu: false)
 * - หลัง long press จะกลืน click ที่ตามมา ปุ่มข้างใต้จึงไม่ทำงานซ้อน
 *
 *   Gestures.longPress(el, {
 *     onLongPress(e, { x, y }) { ... },
 *     onStart() {}, onCancel() {},   // ไม่บังคับ — ใช้ทำ animation ระหว่างกด
 *     duration: 500,                 // ms
 *     maxMove: 10,                   // px ขยับเกินนี้ = ยกเลิก
 *     pressingClass: 'is-pressing',
 *   });
 */
(function (root) {
  'use strict';

  function longPress(el, opts) {
    const o = Object.assign(
      {
        onLongPress: null,
        onStart: null,
        onCancel: null,
        duration: 500,
        maxMove: 10,
        haptic: true,
        contextMenu: true,
        pressingClass: 'is-pressing',
      },
      opts
    );
    let start = null;
    let timer = 0;
    let fired = false;

    el.style.webkitTouchCallout = 'none';
    el.style.webkitUserSelect = 'none';
    el.style.userSelect = 'none';

    function pointFrom(e) {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function fire(e) {
      fired = true;
      el.classList.remove(o.pressingClass);
      if (o.haptic && navigator.vibrate) navigator.vibrate(10);
      if (o.onLongPress) o.onLongPress(e, pointFrom(e));
    }

    function down(e) {
      if (e.button > 0) return;
      fired = false;
      start = { id: e.pointerId, x: e.clientX, y: e.clientY };
      el.classList.add(o.pressingClass);
      if (o.onStart) o.onStart(e);
      timer = setTimeout(() => {
        start = null;
        fire(e);
      }, o.duration);
    }

    function move(e) {
      if (!start || e.pointerId !== start.id) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > o.maxMove) cancel();
    }

    function cancel() {
      if (!start) return;
      clearTimeout(timer);
      start = null;
      el.classList.remove(o.pressingClass);
      if (o.onCancel) o.onCancel();
    }

    function swallowClick(e) {
      if (!fired) return;
      fired = false;
      e.preventDefault();
      e.stopPropagation();
    }

    function contextmenu(e) {
      e.preventDefault();
      if (!o.contextMenu || fired || start) return;
      fire(e);
    }

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('click', swallowClick, true);
    el.addEventListener('contextmenu', contextmenu);

    return {
      destroy() {
        clearTimeout(timer);
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', cancel);
        el.removeEventListener('pointercancel', cancel);
        el.removeEventListener('pointerleave', cancel);
        el.removeEventListener('click', swallowClick, true);
        el.removeEventListener('contextmenu', contextmenu);
      },
    };
  }

  (root.Gestures = root.Gestures || {}).longPress = longPress;
  if (typeof module === 'object' && module.exports) module.exports = longPress;
})(typeof window !== 'undefined' ? window : globalThis);
