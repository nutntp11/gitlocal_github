/**
 * Edge swipe — ปัดจากขอบจอเพื่อย้อนกลับหน้าก่อน (หรือเปิดเมนูข้าง)
 *
 * - เริ่มนับเฉพาะเมื่อนิ้วแตะในแถบ edgeWidth px จากขอบ
 * - หน้าปัจจุบันเลื่อนตามนิ้ว หน้าข้างใต้ขยับแบบ parallax (เหมือน UINavigationController)
 * - ปล่อยเกิน threshold ของความกว้าง หรือปัดเร็ว → ย้อนกลับ · ไม่งั้นเด้งคืน
 *
 * หมายเหตุ: Safari บน iPhone ใช้ปัดขอบซ้ายเป็น "ย้อนกลับ" ของเบราว์เซอร์เอง —
 * ใน web app ที่เปิดเต็มจอ (Add to Home Screen) หรือ WebView จะไม่ชนกัน
 *
 *   Gestures.edgeSwipe(screenEl, {
 *     page: detailEl,        // หน้าที่เลื่อนออก
 *     under: listEl,         // หน้าข้างใต้ (ไม่บังคับ)
 *     onBack() { detailEl.hidden = true; },
 *     enabled: () => !detailEl.hidden,
 *     edge: 'left',          // หรือ 'right'
 *   });
 */
(function (root) {
  'use strict';

  const EASE = 'cubic-bezier(.2,.8,.2,1)';

  function edgeSwipe(container, opts) {
    const o = Object.assign(
      {
        page: null,
        under: null,
        edge: 'left',
        edgeWidth: 24,
        threshold: 0.4,
        velocity: 0.5,
        parallax: 0.3,
        enabled: () => true,
        onProgress: null,
        onBack: null,
        onCancel: null,
      },
      opts
    );
    const dir = o.edge === 'right' ? -1 : 1;
    let drag = null;

    if (!container.style.touchAction) container.style.touchAction = 'pan-y';

    function paint(p, animate) {
      const t = animate ? 'transform .32s ' + EASE + ', box-shadow .32s' : 'none';
      const w = container.clientWidth;
      if (o.page) {
        o.page.style.transition = t;
        o.page.style.transform = p ? 'translateX(' + dir * p * w + 'px)' : '';
        o.page.style.boxShadow = p ? dir * -8 + 'px 0 24px rgba(0,0,0,' + 0.18 * (1 - p) + ')' : '';
      }
      if (o.under) {
        o.under.style.transition = t;
        o.under.style.transform = p ? 'translateX(' + -dir * o.parallax * (1 - p) * w + 'px)' : '';
      }
      if (o.onProgress) o.onProgress(p);
    }

    function down(e) {
      if (e.button > 0 || drag || !o.enabled()) return;
      const r = container.getBoundingClientRect();
      const fromEdge = dir === 1 ? e.clientX - r.left : r.right - e.clientX;
      if (fromEdge > o.edgeWidth) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false, p: 0, v: 0, lx: e.clientX, t: e.timeStamp };
    }

    function move(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = (e.clientX - drag.x) * dir;
      if (!drag.active) {
        if (Math.abs(e.clientY - drag.y) > 10 && Math.abs(e.clientY - drag.y) > dx) return (drag = null);
        if (dx < 6) return;
        drag.active = true;
        container.setPointerCapture(e.pointerId);
      }
      const dt = Math.max(1, e.timeStamp - drag.t);
      drag.v = ((e.clientX - drag.lx) * dir) / dt;
      drag.lx = e.clientX;
      drag.t = e.timeStamp;
      drag.p = Math.min(Math.max(dx / container.clientWidth, 0), 1);
      paint(drag.p, false);
    }

    function up(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const { active, p, v } = drag;
      drag = null;
      if (!active) return;
      const done = (p > o.threshold && v > -o.velocity) || v > o.velocity;
      paint(done ? 1 : 0, true);
      setTimeout(() => {
        if (done) {
          if (o.onBack) o.onBack();
          if (o.page) o.page.style.transition = 'none';
          if (o.under) o.under.style.transition = 'none';
          paint(0, false);
        } else if (o.onCancel) {
          o.onCancel();
        }
      }, 320);
    }

    container.addEventListener('pointerdown', down);
    container.addEventListener('pointermove', move);
    container.addEventListener('pointerup', up);
    container.addEventListener('pointercancel', up);

    return {
      destroy() {
        container.removeEventListener('pointerdown', down);
        container.removeEventListener('pointermove', move);
        container.removeEventListener('pointerup', up);
        container.removeEventListener('pointercancel', up);
      },
    };
  }

  (root.Gestures = root.Gestures || {}).edgeSwipe = edgeSwipe;
  if (typeof module === 'object' && module.exports) module.exports = edgeSwipe;
})(typeof window !== 'undefined' ? window : globalThis);
