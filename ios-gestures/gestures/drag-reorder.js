/**
 * Drag — ลากเพื่อเรียงลำดับรายการใหม่ (to-do, playlist, ลำดับร้านในเส้นทาง)
 *
 * - จับที่ "ด้ามจับ" ([data-drag-handle]) ถ้าแถวนั้นมี — ไม่งั้นจับได้ทั้งแถว
 *   (รายการยาวที่ต้องเลื่อนจอด้วยนิ้ว ควรมีด้ามจับ ไม่งั้นนิ้วจะลากแทนการเลื่อน)
 * - แถวอื่นเลื่อนหลบให้แบบมี animation แล้วค่อยย้าย DOM จริงตอนปล่อย
 *
 *   Gestures.dragReorder(listEl, {
 *     onReorder(from, to, item) { ... },   // index เดิม → index ใหม่
 *     handle: '[data-drag-handle]',
 *     draggingClass: 'is-dragging',
 *   });
 */
(function (root) {
  'use strict';

  const EASE = 'cubic-bezier(.2,.8,.2,1)';

  function dragReorder(list, opts) {
    const o = Object.assign({ onReorder: null, handle: '[data-drag-handle]', draggingClass: 'is-dragging' }, opts);
    let drag = null;

    function itemOf(target) {
      let n = target;
      while (n && n.parentElement !== list) n = n.parentElement;
      return n;
    }

    function prepare() {
      Array.from(list.children).forEach((item) => {
        const h = item.querySelector(o.handle);
        (h || item).style.touchAction = 'none';
      });
    }

    function down(e) {
      if (e.button > 0 || drag) return;
      const item = itemOf(e.target);
      if (!item) return;
      const handle = item.querySelector(o.handle);
      if (handle && !handle.contains(e.target)) return;
      e.preventDefault();

      const items = Array.from(list.children);
      const rects = items.map((n) => n.getBoundingClientRect());
      const from = items.indexOf(item);
      const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 0;
      drag = { id: e.pointerId, y: e.clientY, item, items, rects, from, to: from, step: rects[from].height + gap };

      list.setPointerCapture(e.pointerId);
      item.classList.add(o.draggingClass);
      if (getComputedStyle(item).position === 'static') item.style.position = 'relative';
      item.style.zIndex = '2';
      item.style.transition = 'none';
      items.forEach((n) => {
        if (n !== item) n.style.transition = 'transform .2s ' + EASE;
      });
      if (navigator.vibrate) navigator.vibrate(8);
    }

    function move(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const { item, items, rects, from, step } = drag;
      const first = rects[0].top;
      const last = rects[rects.length - 1].bottom;
      const self = rects[from];
      const dy = Math.min(Math.max(e.clientY - drag.y, first - self.top), last - self.bottom);
      item.style.transform = 'translateY(' + dy + 'px) scale(1.02)';

      const center = self.top + self.height / 2 + dy;
      let to = from;
      for (let i = from + 1; i < rects.length; i++) if (center > rects[i].top + rects[i].height / 2) to = i;
      for (let i = from - 1; i >= 0; i--) if (center < rects[i].top + rects[i].height / 2) to = i;
      drag.to = to;

      items.forEach((n, i) => {
        if (n === item) return;
        let shift = 0;
        if (i > from && i <= to) shift = -step;
        if (i < from && i >= to) shift = step;
        n.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
      });
    }

    function up(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const { item, items, rects, from, to } = drag;
      drag = null;

      const target = to > from ? rects[to].bottom - rects[from].height : rects[to].top;
      item.style.transition = 'transform .2s ' + EASE;
      item.style.transform = 'translateY(' + (target - rects[from].top) + 'px)';

      setTimeout(() => {
        items.forEach((n) => {
          n.style.transition = 'none';
          n.style.transform = '';
        });
        requestAnimationFrame(() => items.forEach((n) => (n.style.transition = '')));
        item.style.zIndex = '';
        item.classList.remove(o.draggingClass);
        if (to !== from) {
          list.insertBefore(item, to > from ? items[to].nextSibling : items[to]);
          if (o.onReorder) o.onReorder(from, to, item);
        }
      }, 200);
    }

    prepare();
    const observer = new MutationObserver(prepare);
    observer.observe(list, { childList: true });
    list.addEventListener('pointerdown', down);
    list.addEventListener('pointermove', move);
    list.addEventListener('pointerup', up);
    list.addEventListener('pointercancel', up);

    return {
      destroy() {
        observer.disconnect();
        list.removeEventListener('pointerdown', down);
        list.removeEventListener('pointermove', move);
        list.removeEventListener('pointerup', up);
        list.removeEventListener('pointercancel', up);
      },
    };
  }

  (root.Gestures = root.Gestures || {}).dragReorder = dragReorder;
  if (typeof module === 'object' && module.exports) module.exports = dragReorder;
})(typeof window !== 'undefined' ? window : globalThis);
