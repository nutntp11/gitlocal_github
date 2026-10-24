/**
 * Tap — แตะครั้งเดียว
 *
 * ต่างจาก `click` ตรงที่ไม่นับเป็น tap ถ้านิ้วลากเกิน maxMove หรือกดค้างนานเกิน maxDuration
 * (กันกดโดนตอนกำลังเลื่อนหน้าจอ) และใส่ class ระหว่างกด เพื่อทำ feedback แบบ iOS
 *
 *   const off = Gestures.tap(el, {
 *     onTap(e, { x, y }) { ... },   // x, y = ตำแหน่งที่แตะ เทียบกับมุมซ้ายบนของ el
 *     maxMove: 10,                  // px
 *     maxDuration: 500,             // ms
 *     pressedClass: 'is-pressed',
 *   });
 *   off.destroy();
 */
(function (root) {
  'use strict';

  function tap(el, opts) {
    const o = Object.assign(
      { onTap: null, maxMove: 10, maxDuration: 500, pressedClass: 'is-pressed' },
      opts
    );
    let start = null;

    function down(e) {
      if (e.button > 0 || start) return;
      start = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp };
      el.classList.add(o.pressedClass);
    }

    function move(e) {
      if (!start || e.pointerId !== start.id) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > o.maxMove) reset();
    }

    function up(e) {
      if (!start || e.pointerId !== start.id) return;
      const quick = e.timeStamp - start.t <= o.maxDuration;
      reset();
      if (!quick || !o.onTap) return;
      const r = el.getBoundingClientRect();
      o.onTap(e, { x: e.clientX - r.left, y: e.clientY - r.top });
    }

    function reset() {
      start = null;
      el.classList.remove(o.pressedClass);
    }

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', reset);
    el.addEventListener('pointerleave', reset);

    return {
      destroy() {
        reset();
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', reset);
        el.removeEventListener('pointerleave', reset);
      },
    };
  }

  (root.Gestures = root.Gestures || {}).tap = tap;
  if (typeof module === 'object' && module.exports) module.exports = tap;
})(typeof window !== 'undefined' ? window : globalThis);
