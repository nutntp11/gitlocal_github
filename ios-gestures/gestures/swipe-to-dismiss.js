/**
 * Swipe to dismiss — ปัดลงเพื่อปิด bottom sheet / modal / รูปที่เปิดเต็มจอ
 *
 * - ลากลงตามนิ้ว · ลากขึ้นมีแรงต้าน · ฉากหลัง (backdrop) จางลงตามระยะ
 * - ปล่อยเกิน threshold ของความสูง หรือปัดเร็ว → ปิด · ไม่งั้นเด้งคืน
 * - ถ้าในชีทมีกล่องเลื่อนได้ (scroller) และยังไม่อยู่บนสุด → เลื่อนเนื้อหาก่อน ไม่ปิดชีท
 * - แตะ backdrop หรือกด Esc = ปิด
 *
 * ต้องการ: CSS วางตำแหน่งชีทเอง (เช่น position:absolute; left:0; right:0; bottom:0)
 *
 *   const sheet = Gestures.swipeToDismiss(sheetEl, {
 *     backdrop: backdropEl,
 *     scroller: sheetEl.querySelector('.sheet-body'),
 *     onDismiss() { ... },
 *   });
 *   sheet.open(); sheet.close();
 */
(function (root) {
  'use strict';

  const EASE = 'cubic-bezier(.2,.8,.2,1)';

  function swipeToDismiss(sheet, opts) {
    const o = Object.assign(
      { backdrop: null, scroller: null, threshold: 0.3, velocity: 0.6, onDismiss: null, onOpen: null },
      opts
    );
    let drag = null;
    let isOpen = !sheet.hidden;
    let closeTimer = 0;

    sheet.style.overscrollBehavior = 'contain';

    function paint(y, animate) {
      const t = animate ? '.32s ' + EASE : '0s';
      sheet.style.transition = 'transform ' + t;
      sheet.style.transform = y ? 'translateY(' + y + 'px)' : '';
      if (o.backdrop) {
        o.backdrop.style.transition = 'opacity ' + t;
        o.backdrop.style.opacity = String(1 - Math.min(1, Math.max(0, y) / sheet.offsetHeight));
      }
    }

    function open() {
      clearTimeout(closeTimer);
      sheet.hidden = false;
      if (o.backdrop) o.backdrop.hidden = false;
      paint(sheet.offsetHeight, false);
      sheet.getBoundingClientRect(); // บังคับ reflow ก่อนเริ่ม animation
      paint(0, true);
      isOpen = true;
      if (o.onOpen) o.onOpen();
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      paint(sheet.offsetHeight, true);
      closeTimer = setTimeout(() => {
        sheet.hidden = true;
        if (o.backdrop) o.backdrop.hidden = true;
        if (o.onDismiss) o.onDismiss();
      }, 320);
    }

    function start(y, target) {
      if (!isOpen) return;
      const inScroller = o.scroller && o.scroller.contains(target);
      drag = { y, inScroller, active: false, dy: 0, v: 0, ly: y, t: performance.now() };
    }

    function moveTo(y, e) {
      if (!drag) return;
      const raw = y - drag.y;
      if (!drag.active) {
        if (Math.abs(raw) < 4) return;
        // ดึงขึ้น หรือเนื้อหายังเลื่อนขึ้นได้ → ปล่อยให้เลื่อนตามปกติ
        if (raw < 0 && drag.inScroller) return (drag = null);
        if (drag.inScroller && o.scroller.scrollTop > 0) return (drag = null);
        drag.active = true;
      }
      if (e.cancelable) e.preventDefault();
      const now = performance.now();
      drag.v = (y - drag.ly) / Math.max(1, now - drag.t);
      drag.ly = y;
      drag.t = now;
      drag.dy = raw > 0 ? raw : raw / 4;
      paint(drag.dy, false);
    }

    function end() {
      if (!drag) return;
      const { active, dy, v } = drag;
      drag = null;
      if (!active) return;
      const done = (dy > sheet.offsetHeight * o.threshold && v > -o.velocity) || v > o.velocity;
      if (done) close();
      else paint(0, true);
    }

    const ts = (e) => e.touches.length === 1 && start(e.touches[0].clientY, e.target);
    const tm = (e) => moveTo(e.touches[0].clientY, e);
    const md = (e) => {
      if (e.button !== 0 || e.target.closest('button, a, input, textarea, select')) return;
      start(e.clientY, e.target);
      window.addEventListener('mousemove', mm);
      window.addEventListener('mouseup', mu);
    };
    const mm = (e) => moveTo(e.clientY, e);
    const mu = () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      end();
    };
    const key = (e) => e.key === 'Escape' && close();

    sheet.addEventListener('touchstart', ts, { passive: true });
    sheet.addEventListener('touchmove', tm, { passive: false });
    sheet.addEventListener('touchend', end);
    sheet.addEventListener('touchcancel', end);
    sheet.addEventListener('mousedown', md);
    sheet.addEventListener('keydown', key);
    if (o.backdrop) o.backdrop.addEventListener('click', close);

    return {
      open,
      close,
      get isOpen() { return isOpen; },
      destroy() {
        mu();
        clearTimeout(closeTimer);
        sheet.removeEventListener('touchstart', ts);
        sheet.removeEventListener('touchmove', tm);
        sheet.removeEventListener('touchend', end);
        sheet.removeEventListener('touchcancel', end);
        sheet.removeEventListener('mousedown', md);
        sheet.removeEventListener('keydown', key);
        if (o.backdrop) o.backdrop.removeEventListener('click', close);
      },
    };
  }

  (root.Gestures = root.Gestures || {}).swipeToDismiss = swipeToDismiss;
  if (typeof module === 'object' && module.exports) module.exports = swipeToDismiss;
})(typeof window !== 'undefined' ? window : globalThis);
