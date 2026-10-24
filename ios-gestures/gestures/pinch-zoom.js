/**
 * Pinch — สองนิ้วถ่าง/หุบเพื่อซูมรูป แผนที่ หรือกราฟ
 *
 * - ซูมรอบจุดกึ่งกลางระหว่างสองนิ้ว · ซูมแล้วใช้นิ้วเดียวเลื่อนดูได้ · ปล่อยแล้วเด้งกลับเข้าขอบ
 * - แตะสองครั้ง = ซูมเข้า/ออก · บนคอมพิวเตอร์: pinch บน trackpad หรือ Ctrl + scroll
 *
 * ต้องการ: viewport (กรอบ) กับ content (ของข้างในที่ถูกซูม — ค่าเริ่มต้น = ลูกตัวแรกของ viewport)
 *
 *   const zoom = Gestures.pinchZoom(viewportEl, {
 *     minScale: 1, maxScale: 4, doubleTapScale: 2.5,
 *     onChange({ scale, x, y }) { ... },
 *   });
 *   zoom.zoomTo(2, cx, cy); zoom.reset(); zoom.destroy();
 */
(function (root) {
  'use strict';

  const EASE = 'cubic-bezier(.2,.8,.2,1)';

  function pinchZoom(viewport, opts) {
    const o = Object.assign(
      { content: viewport.firstElementChild, minScale: 1, maxScale: 4, doubleTapScale: 2.5, onChange: null },
      opts
    );
    const content = o.content;
    const pointers = new Map();
    let s = 1, tx = 0, ty = 0;
    let gesture = null;
    let lastTap = null;

    viewport.style.touchAction = 'none';
    viewport.style.overflow = 'hidden';
    content.style.transformOrigin = '0 0';
    content.style.willChange = 'transform';

    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

    function local(p) {
      const r = viewport.getBoundingClientRect();
      return { x: p.x - r.left, y: p.y - r.top };
    }

    function apply(animate) {
      content.style.transition = animate ? 'transform .3s ' + EASE : 'none';
      content.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
      if (o.onChange) o.onChange({ scale: s, x: tx, y: ty });
    }

    // ขอบที่เลื่อนไปได้ ณ scale ปัจจุบัน — ถ้าเล็กกว่ากรอบให้อยู่กลาง
    function bounds(scale) {
      const w = viewport.clientWidth, h = viewport.clientHeight;
      const cw = content.offsetWidth * scale, ch = content.offsetHeight * scale;
      const bx = cw <= w ? [(w - cw) / 2, (w - cw) / 2] : [w - cw, 0];
      const by = ch <= h ? [(h - ch) / 2, (h - ch) / 2] : [h - ch, 0];
      return { x: bx, y: by };
    }

    function rubber(v, lo, hi) {
      if (v < lo) return lo - (lo - v) / 3;
      if (v > hi) return hi + (v - hi) / 3;
      return v;
    }

    function zoomTo(scale, cx, cy, animate) {
      const ns = clamp(scale, o.minScale, o.maxScale);
      if (cx == null) { cx = viewport.clientWidth / 2; cy = viewport.clientHeight / 2; }
      tx = cx - ((cx - tx) / s) * ns;
      ty = cy - ((cy - ty) / s) * ns;
      s = ns;
      const b = bounds(s);
      tx = clamp(tx, b.x[0], b.x[1]);
      ty = clamp(ty, b.y[0], b.y[1]);
      apply(animate !== false);
    }

    function begin() {
      const pts = Array.from(pointers.values());
      if (pts.length >= 2) {
        const a = local(pts[0]), b = local(pts[1]);
        gesture = {
          type: 'pinch',
          dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          s, tx, ty,
        };
      } else if (pts.length === 1) {
        gesture = { type: 'pan', start: local(pts[0]), tx, ty };
      } else {
        gesture = null;
      }
    }

    function down(e) {
      if (e.button > 0) return;
      viewport.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp, sx: e.clientX, sy: e.clientY });
      begin();
    }

    function move(e) {
      const p = pointers.get(e.pointerId);
      if (!p || !gesture) return;
      p.x = e.clientX;
      p.y = e.clientY;

      if (gesture.type === 'pinch' && pointers.size >= 2) {
        const pts = Array.from(pointers.values());
        const a = local(pts[0]), b = local(pts[1]);
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const ns = clamp((gesture.s * dist) / gesture.dist, o.minScale * 0.6, o.maxScale * 1.4);
        const cx = (gesture.mid.x - gesture.tx) / gesture.s;
        const cy = (gesture.mid.y - gesture.ty) / gesture.s;
        s = ns;
        tx = mid.x - cx * ns;
        ty = mid.y - cy * ns;
        apply(false);
      } else if (gesture.type === 'pan' && s > o.minScale) {
        const q = local(p);
        const b = bounds(s);
        tx = rubber(gesture.tx + q.x - gesture.start.x, b.x[0], b.x[1]);
        ty = rubber(gesture.ty + q.y - gesture.start.y, b.y[0], b.y[1]);
        apply(false);
      }
    }

    function up(e) {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      pointers.delete(e.pointerId);
      const isTap = gesture && gesture.type === 'pan' &&
        e.timeStamp - p.t < 300 && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 10;

      if (pointers.size > 0) return begin();
      gesture = null;

      if (isTap) {
        const q = local({ x: e.clientX, y: e.clientY });
        if (lastTap && e.timeStamp - lastTap.t < 300 && Math.hypot(q.x - lastTap.x, q.y - lastTap.y) < 40) {
          lastTap = null;
          return s > o.minScale + 0.01 ? zoomTo(o.minScale) : zoomTo(o.doubleTapScale, q.x, q.y);
        }
        lastTap = { t: e.timeStamp, x: q.x, y: q.y };
      }
      zoomTo(s); // เด้งกลับเข้าขอบ/ช่วง scale
    }

    function wheel(e) {
      if (!e.ctrlKey && s <= o.minScale) return;
      e.preventDefault();
      const q = local({ x: e.clientX, y: e.clientY });
      if (e.ctrlKey) {
        zoomTo(s * Math.exp(-e.deltaY * 0.01), q.x, q.y, false);
      } else {
        const b = bounds(s);
        tx = clamp(tx - e.deltaX, b.x[0], b.x[1]);
        ty = clamp(ty - e.deltaY, b.y[0], b.y[1]);
        apply(false);
      }
    }

    viewport.addEventListener('pointerdown', down);
    viewport.addEventListener('pointermove', move);
    viewport.addEventListener('pointerup', up);
    viewport.addEventListener('pointercancel', up);
    viewport.addEventListener('wheel', wheel, { passive: false });
    zoomTo(o.minScale, null, null, false);

    return {
      zoomTo: (scale, x, y) => zoomTo(scale, x, y),
      reset: () => zoomTo(o.minScale),
      get scale() { return s; },
      destroy() {
        viewport.removeEventListener('pointerdown', down);
        viewport.removeEventListener('pointermove', move);
        viewport.removeEventListener('pointerup', up);
        viewport.removeEventListener('pointercancel', up);
        viewport.removeEventListener('wheel', wheel);
      },
    };
  }

  (root.Gestures = root.Gestures || {}).pinchZoom = pinchZoom;
  if (typeof module === 'object' && module.exports) module.exports = pinchZoom;
})(typeof window !== 'undefined' ? window : globalThis);
