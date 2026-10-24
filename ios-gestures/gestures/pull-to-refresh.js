/**
 * Pull to refresh — ดึงรายการลงจากบนสุดเพื่อโหลดข้อมูลใหม่
 *
 * - เริ่มดึงได้เฉพาะตอนเลื่อนอยู่บนสุด · มีแรงต้าน · สั่นเบาๆ ตอนดึงถึงระยะ
 * - ปล่อยเกิน threshold → โชว์ spinner ค้างไว้จนกว่า onRefresh (async) จะเสร็จ
 * - ใช้ touch event (ไม่ใช่ pointer) เพื่อกันเบราว์เซอร์แย่งไปเลื่อนหน้า + รองรับเมาส์
 *
 * ต้องการ: scroller = กล่องที่ overflow-y: auto (โมดูลจะห่อเนื้อหาเดิมไว้ใน track)
 *
 *   const ptr = Gestures.pullToRefresh(scrollerEl, {
 *     async onRefresh() { await loadNewData(); },
 *     threshold: 64, maxPull: 150,
 *   });
 *   ptr.refresh(); // สั่งรีเฟรชเองจากโค้ด
 */
(function (root) {
  'use strict';

  const EASE = 'cubic-bezier(.2,.8,.2,1)';
  const STYLE_ID = 'gestures-ptr-style';

  function spinnerSvg() {
    let ticks = '';
    for (let i = 0; i < 8; i++) {
      ticks +=
        '<rect x="13" y="2" width="2.6" height="7" rx="1.3" fill="currentColor" ' +
        'transform="rotate(' + i * 45 + ' 14.3 14)" style="opacity:0"/>';
    }
    return '<svg viewBox="0 0 28.6 28" width="26" height="26" aria-hidden="true">' + ticks + '</svg>';
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      '@keyframes gestures-ptr-spin{to{transform:rotate(360deg)}}' +
      '.gestures-ptr-spinning svg{animation:gestures-ptr-spin .8s steps(8) infinite}';
    document.head.appendChild(st);
  }

  function pullToRefresh(scroller, opts) {
    const o = Object.assign({ onRefresh: null, threshold: 64, maxPull: 150, indicatorHeight: 56 }, opts);
    injectStyle();

    const track = document.createElement('div');
    while (scroller.firstChild) track.appendChild(scroller.firstChild);
    const indicator = document.createElement('div');
    indicator.setAttribute('role', 'status');
    indicator.setAttribute('aria-label', 'กำลังรีเฟรช');
    indicator.style.cssText =
      'position:absolute;left:0;right:0;top:0;display:flex;align-items:center;justify-content:center;' +
      'pointer-events:none;color:currentColor;opacity:.6;height:' + o.indicatorHeight + 'px;' +
      'transform:translateY(-100%)';
    indicator.innerHTML = spinnerSvg();
    const ticks = indicator.querySelectorAll('rect');

    if (getComputedStyle(scroller).position === 'static') scroller.style.position = 'relative';
    scroller.style.overscrollBehaviorY = 'contain';
    scroller.append(indicator, track);

    let pull = null;
    let distance = 0;
    let refreshing = false;
    let suppressClick = false;

    function render(d, animate) {
      distance = d;
      const t = animate ? 'transform .35s ' + EASE : 'none';
      track.style.transition = indicator.style.transition = t;
      track.style.transform = d ? 'translateY(' + d + 'px)' : '';
      indicator.style.transform = 'translateY(' + (d - o.indicatorHeight) + 'px)';
      if (!refreshing) {
        const shown = Math.round(Math.min(1, d / o.threshold) * ticks.length);
        ticks.forEach((r, i) => (r.style.opacity = i < shown ? String(0.25 + (0.75 * i) / ticks.length) : '0'));
      }
    }

    // แรงต้าน: ยิ่งดึงยิ่งหนืด ไม่เกิน maxPull (ดึงจริง ~115px ถึง threshold 64)
    function resist(raw) {
      return o.maxPull * (1 - 1 / (raw / o.maxPull + 1));
    }

    function start(y) {
      if (refreshing || scroller.scrollTop > 0) return;
      pull = { y, armed: false, active: false };
    }

    function moveTo(y, e) {
      if (!pull) return;
      const raw = y - pull.y;
      if (!pull.active) {
        if (raw < 4) {
          if (raw < -4) pull = null; // ดึงขึ้น = เลื่อนตามปกติ
          return;
        }
        pull.active = true;
      }
      if (e.cancelable) e.preventDefault();
      const d = resist(Math.max(0, raw));
      const armed = d >= o.threshold;
      if (armed && !pull.armed && navigator.vibrate) navigator.vibrate(8);
      pull.armed = armed;
      render(d, false);
    }

    function end() {
      if (!pull) return;
      const { armed, active } = pull;
      pull = null;
      if (!active) return;
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
      if (armed) refresh();
      else render(0, true);
    }

    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      ticks.forEach((r, i) => (r.style.opacity = String(0.25 + (0.75 * i) / ticks.length)));
      indicator.classList.add('gestures-ptr-spinning');
      render(o.indicatorHeight, true);
      try {
        if (o.onRefresh) await o.onRefresh();
      } finally {
        indicator.classList.remove('gestures-ptr-spinning');
        refreshing = false;
        render(0, true);
      }
    }

    const ts = (e) => e.touches.length === 1 && start(e.touches[0].clientY);
    const tm = (e) => moveTo(e.touches[0].clientY, e);
    const md = (e) => {
      if (e.button !== 0) return;
      start(e.clientY);
      window.addEventListener('mousemove', mm);
      window.addEventListener('mouseup', mu);
    };
    const mm = (e) => moveTo(e.clientY, e);
    const mu = () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      end();
    };
    const click = (e) => {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
    };

    scroller.addEventListener('touchstart', ts, { passive: true });
    scroller.addEventListener('touchmove', tm, { passive: false });
    scroller.addEventListener('touchend', end);
    scroller.addEventListener('touchcancel', end);
    scroller.addEventListener('mousedown', md);
    scroller.addEventListener('click', click, true);
    render(0, false);

    return {
      refresh,
      get distance() { return distance; },
      destroy() {
        mu();
        scroller.removeEventListener('touchstart', ts);
        scroller.removeEventListener('touchmove', tm);
        scroller.removeEventListener('touchend', end);
        scroller.removeEventListener('touchcancel', end);
        scroller.removeEventListener('mousedown', md);
        scroller.removeEventListener('click', click, true);
        indicator.remove();
        while (track.firstChild) scroller.appendChild(track.firstChild);
        track.remove();
      },
    };
  }

  (root.Gestures = root.Gestures || {}).pullToRefresh = pullToRefresh;
  if (typeof module === 'object' && module.exports) module.exports = pullToRefresh;
})(typeof window !== 'undefined' ? window : globalThis);
