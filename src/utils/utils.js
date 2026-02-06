function copyComputedStyle(computed, target) {
  for (let prop of computed) {
    try {
      target.style[prop] = computed.getPropertyValue(prop);
    } catch (e) {
      // 某些属性是只读的，忽略即可
    }
  }
}

function inlineComputedStyles(root) {
  // 拿到 root 的所有子节点（包含 root 自身）
  const allNodes = root.querySelectorAll('*');

  // 给 root 自身也处理一下
  applyStyles(root);

  // 遍历子节点
  allNodes.forEach(node => {
    applyStyles(node);
  });

  // 内部函数：把 computed styles 写到 style 上
  function applyStyles(el) {
    const computed = getComputedStyle(el);
    for (let prop of computed) {
      try {
        el.style.setProperty(prop, computed.getPropertyValue(prop), computed.getPropertyPriority(prop));
      } catch (e) {
        // 某些属性只读，忽略即可
      }
    }
  }
}


/**
 * 把 root 及其子节点的 computed styles 内联化，但会过滤掉黑名单里的属性。
 * @param {Element} root
 * @param {Object} [opts]
 * @param {string[]} [opts.blacklist] - 要过滤的属性名（CSS 名称），支持前缀（如 "-webkit-"）
 */
function inlineComputedStylesFiltered(root, opts = {}) {
  if (!root) {
    return
  }

  // 默认黑名单（你可以在调用时传入更多或覆盖）
  const defaultBlacklist = [
    // vendor prefixes（所有 -webkit- / -moz- / -ms-）
    '-webkit-', '-moz-', '-ms-',

    // 常见的 UA / 渲染相关、会污染颜色或行为的属性
    'animation', 'animation-delay', 'animation-direction', 'animation-duration', 'animation-fill-mode',
    'animation-iteration-count', 'animation-name', 'animation-play-state', 'animation-timing-function',
    'transition', 'transition-delay', 'transition-duration', 'transition-property', 'transition-timing-function',
    'will-change', 'filter', 'backdrop-filter', 'overscroll-behavior', 'overscroll-behavior-x', 'overscroll-behavior-y',
    'caret-color', 'text-rendering', 'text-size-adjust', '-webkit-text-fill-color', '-webkit-text-stroke', '-webkit-font-smoothing',
    'user-select', 'touch-action', 'pointer-events', 'appearance', '-webkit-appearance',
    'outline', 'outline-color', 'outline-style', 'outline-width',
    'box-shadow', 'text-shadow',
    'cursor',
    'mix-blend-mode', 'isolation',
    'zoom', // 有的阅读器会在 computed 加 zoom
    'paint-order', // rendering related
    'unicode-bidi', // 可能影响文字方向
    'direction', // 如果你不想改变流向可过滤
  ];

  const blacklist = (opts.blacklist && Array.isArray(opts.blacklist))
    ? Array.from(new Set([...defaultBlacklist, ...opts.blacklist]))
    : defaultBlacklist;

  // helper: 是否命中 blacklist（支持前缀匹配）
  function isBlacklisted(prop) {
    if (!prop) return false;
    const p = prop.toLowerCase();
    for (const rule of blacklist) {
      const r = rule.toLowerCase();
      if (r.endsWith('-')) {
        // treat as prefix match (e.g. "-webkit-")
        if (p.startsWith(r)) return true;
      } else {
        // exact match or "starts with" for group names like "animation"
        if (p === r || p.startsWith(r + '-') || p.startsWith(r)) return true;
      }
    }
    return false;
  }

  // collect nodes (root + descendants)
  const all = [root, ...Array.from(root.querySelectorAll('*'))];

  all.forEach(el => {
    const computed = getComputedStyle(el);
    // keep a copy of existing inline style (we'll append to it so inline styles originally present keep highest priority)
    const existingInline = el.getAttribute('style') || '';

    // Build a temporary CSS text to set in one go (avoid many layout thrash)
    // Note: we still set via el.style.setProperty to preserve priority handling.
    for (const prop of computed) {
      try {
        // prop is CSS property name like "font-size" or "-webkit-text-fill-color"
        if (isBlacklisted(prop)) continue;

        const val = computed.getPropertyValue(prop);
        const prio = computed.getPropertyPriority(prop);
        // Skip empty values
        if (!val) continue;

        // Set the property
        el.style.setProperty(prop, val, prio);
      } catch (e) {
        // 某些只读或无法设置的属性会抛错，忽略即可
      }
    }

    // 重新附加原始 inline style（确保原始 inline 的优先级最高）
    if (existingInline) {
      // 如果直接 setAttribute 会覆盖上面通过 style.setProperty 写入的属性中重复的项，
      // 我们选择把原始 inline style 追加回去以保留它的优先级表现（inline style 是最高的）
      // 先读取当前 inline（可能已被修改），然后拼接原先保存的 existingInline（避免重复分号问题）
      const currentInline = el.getAttribute('style') || '';
      // 如果 existingInline 已经包含在 currentInline 中，则不重复追加
      if (!currentInline.includes(existingInline.trim())) {
        el.setAttribute('style', currentInline + (currentInline && !currentInline.endsWith(';') ? ';' : '') + existingInline);
      }
    }
  });
}


function getGlobalRect(iframe, elementInIframe) {
  const elRect = elementInIframe.getBoundingClientRect();
  const iframeRect = iframe.getBoundingClientRect();

  // console.log('Element Rect in iframe:', elRect);
  // console.log('Iframe Rect in viewport:', iframeRect);

  return {
    top: iframeRect.top + elRect.top,
    left: iframeRect.left + elRect.left,
    width: elRect.width,
    height: elRect.height,
    bottom: iframeRect.top + elRect.bottom,
    right: iframeRect.left + elRect.right,
  };
}

function getImageResolution(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    img.onerror = reject;
    img.src = src;
  });
}

function roundToNearestMultiple(a, b) {
  if (b === 0) return a; // 防止除以 0
  return Math.round(a / b) * b;
}

async function waitForSvgLoad(svgEl, {docBase = document.baseURI, timeout = 5000} = {}) {
  if (!svgEl) return;
  const imgs = [...svgEl.querySelectorAll('image, img')];

  const loadPromises = imgs.map(el => {
    const href = el.getAttribute('href') || el.getAttribute('xlink:href') || el.getAttribute('src');
    if (!href) return Promise.resolve();
    return new Promise(resolve => {
      try {
        const url = new URL(href, docBase).href;
        const img = new Image();
        let done = false;
        const settle = () => { if (!done) { done = true; resolve(); } };
        img.onload = settle;
        img.onerror = settle;
        img.src = url;
        // 有些情况下 Image 已经缓存完成
        if (img.complete) settle();
      } catch (e) {
        // 非法 URL 直接跳过
        resolve();
      }
    });
  });

  // 等待字体加载（若支持）和图片加载，且有超时保护
  const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  const allResources = Promise.all(loadPromises).then(() => fontsReady);
  const timeoutPromise = new Promise(resolve => setTimeout(resolve, timeout));
  await Promise.race([allResources, timeoutPromise]);
}

async function getImageDimensions(imgEl, docBase = document.baseURI) {
  if (!imgEl) return null;
  const tag = imgEl.tagName.toLowerCase();
  if (tag === 'img') {
    if (!imgEl.complete) {
      try { await imgEl.decode(); } catch (e) { /* ignore */ }
    }
    return { width: imgEl.naturalWidth, height: imgEl.naturalHeight };
  }
  if (tag === 'image') {
    const href = imgEl.getAttribute('href') || imgEl.getAttribute('xlink:href') || imgEl.getAttribute('src');
    if (!href) return null;
    const url = new URL(href, docBase).href;
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const bitmap = await createImageBitmap(blob);
      return { width: bitmap.width, height: bitmap.height };
    } catch (e) {
      // 回退到 Image()
      return await new Promise(resolve => {
        const tmp = new Image();
        tmp.onload = () => resolve({ width: tmp.naturalWidth, height: tmp.naturalHeight });
        tmp.onerror = () => resolve(null);
        tmp.src = url;
      });
    }
  }
  return null;
}

export { waitForSvgLoad,roundToNearestMultiple, copyComputedStyle, inlineComputedStyles, getGlobalRect, getImageResolution, inlineComputedStylesFiltered };
