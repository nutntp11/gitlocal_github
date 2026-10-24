/**
 * Double tap — แตะสองครั้งติดกัน (เช่น กดถูกใจรูป, ซูมเข้า/ออก)
 *
 * ถ้าใส่ onSingleTap ด้วย ตัว single tap จะถูกหน่วงไว้ `interval` ms เพื่อรอดูว่าจะมีแตะครั้งที่สองไหม
 * (iOS ทำแบบเดียวกัน) — ถ้าไม่ใส่ จะไม่มีการหน่วง
 *
 *   Gestures.doubleTap(el, {
 *     onDoubleTap(e, { x, y }) { ... },
 *     onSingleTap(e, { x, y }) { ... },  // ไม่บังคับ
 *     interval: 300,                    // ms ระหว่างสองแตะ
 *     maxDistance: 40,                  // px ระหว่างจุดแตะทั้งสอง
 *   });
 */
(function (root) {
  'use strict';

  function doubleTap(el, opts) {
    const o = Object.assign(
      { onDoubleTap: null, onSingleTap: null, interval: 300, maxDistance: 40, maxMove: 10, maxDuration: 500 },
      opts
    );
    let start = null;
    let last = null;
    let timer = 0;

    // กันเบราว์เซอร์มือถือซูมหน้าเว็บเมื่อแตะสองครั้ง
    if (!el.style.touchAction) el.style.touchAction = 'manipulation';

    function down(e) {
      if (e.button > 0) return;
      start = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp };
    }

    function up(e) {
      if (!start || e.pointerId !== start.id) return;
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y) > o.maxMove;
      const slow = e.timeStamp - start.t > o.maxDuration;
      start = null;
      if (moved || slow) return;

      const r = el.getBoundingClientRect();
      const point = { x: e.clientX - r.left, y: e.clientY - r.top };
      const isSecond =
        last &&
        e.timeStamp - last.t <= o.interval &&
        Math.hypot(e.clientX - last.cx, e.clientY - last.cy) <= o.maxDistance;

      if (isSecond) {
        clearTimeout(timer);
        last = null;
        if (o.onDoubleTap) o.onDoubleTap(e, point);
        return;
      }
      last = { t: e.timeStamp, cx: e.clientX, cy: e.clientY };
      if (o.onSingleTap) {
        timer = setTimeout(() => {
          last = null;
          o.onSingleTap(e, point);
        }, o.interval);
      }
    }

    function cancel() {
      start = null;
    }

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);

    return {
      destroy() {
        clearTimeout(timer);
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', cancel);
      },
    };
  }

  (root.Gestures = root.Gestures || {}).doubleTap = doubleTap;
  if (typeof module === 'object' && module.exports) module.exports = doubleTap;
})(typeof window !== 'undefined' ? window : globalThis);
