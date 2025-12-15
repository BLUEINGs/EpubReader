<script setup lang="js">
import JSZip from "jszip";
import NoteCard from "@/components/NoteCard.vue";
import { useResizeObserver, useScrollObserver } from '../js/useDOMObserver.js.js';
import { computed, onMounted, onUpdated, ref, watch, watchEffect, nextTick, h } from 'vue';
import ResourceNotFoundError from '../js/ResourceNotFoundError.js';
import { useRoute } from 'vue-router'
import { roundToNearestMultiple, copyComputedStyle, inlineComputedStyles, inlineComputedStylesFiltered, getGlobalRect, getImageResolution } from "@/js/utils.js";

import ChapterNotFound from "./ChapterNotFound.html?raw";
//?raw是把html文件作为字符串导入

const route = useRoute()

/*
关于Promise对象：
1.Promise刚开始既不是成功，也不是失败，而是处于等待态pending（没有被确定）
2.当异步操作成功时，Promise对象的状态会变成fulfilled（成功），此时会调用then方法绑定的回调函数，并将异步操作的结果作为参数传递给回调函数。
3.当异步操作失败时，Promise对象的状态会变成rejected（失败），此时会调用catch方法绑定的回调函数，并将错误信息作为参数传
关于await Promise：
1.await只能在async函数中使用，它会等待一个Promise对象的完成，并返回其的结果。
2.当await后面的Promise对象变为fulfilled时，await表达式会返回该Promise的结果。
3.如果Promise对象变为rejected，await表达式会抛出该Promise的错误信息。（直接在此处抛出异常，下面代码不走了）

*/

const zip = ref(null);//定义zip变量存放解压后的内容
const spineFiles = ref([]);//定义章节文件列表
// const curChapterIndex = ref(localStorage.getItem("curChapterIndex") ? parseInt(localStorage.getItem("curChapterIndex")) : 0);//当前章节索引

const blobResourceCache = ref(new Map());//资源缓存列表，键为资源路径，值为blobUrl或其他对象

const chapters = ref([]);//所有章节内容列表

const prefixs = ref([]) //css作用域前缀

const viewerRef = ref(null);//阅读器容器引用

const metadataOpfPath = ref("");//metadata.opf路径
const metadataOpfDir = computed(() => {
  const lastIndex = metadataOpfPath.value.lastIndexOf('/')
  if (lastIndex == -1) {
    return "";
  } else {
    return metadataOpfPath.value.substring(0, lastIndex);
  }
});//metadata.opf目录路径

const loadXHTMLByHTMLMode = ref(true);//是否以html模式加载xhtml章节文件

const chapterLoadType = computed(() => {
  return loadXHTMLByHTMLMode.value ? "text/html" : "application/xhtml+xml"
})

//初始化：获取章节文件列表
async function init() {
  const response = await fetch('/test8.epub');//fetch函数是现代浏览器的HTTP请求，这是直接请求到"public/test.epub"了
  const arrayBuffer = await response.arrayBuffer();
  //如果响应内容为一个文件，直接用arrayBuffer()方法把它读成二进制数据，Promise里面包的是二进制数据对象ArrayBuffer

  // 解压
  zip.value = await JSZip.loadAsync(arrayBuffer);
  const [spineFilesList, rootfilePath] = await loadSpine(zip.value);//获取章节文件列表
  //此处加载的章节文件列表是相对于metadata.opf的路径，如"Text/chapter1.xhtml"
  // （我最早在这儿写成全局路径不就没这么多事了，实在是难蚌）
  spineFiles.value = spineFilesList;
  metadataOpfPath.value = rootfilePath;
  //其实这个rootfilePath应该叫metadataPath更合适
  const lastIndex = rootfilePath.lastIndexOf('/')
  let rootDir = metadataOpfDir.value;//获取目录文件的路径，如"OEBPS"
  console.log("章节文件位置：", rootDir);
  //并且加载章节
  console.log("开始加载所有章节内容");
  // const promises = []
  for (let i = 0; i < spineFiles.value.length; i++) {
    const filePath = rootDir + (rootDir ? "/" : "") + spineFiles.value[i]
    const file = zip.value.file(filePath)
    if (!file) {
      const chapterNotFound = ChapterNotFound.replace("{{ title }}", `章节${i + 1}加载失败`).replace("{{ filePath }}", filePath)
      const blob = new Blob([chapterNotFound], { type: chapterLoadType.value });//使用blob代替字符串，更优雅
      chapters.value.push(URL.createObjectURL(blob));//占位空章节
      console.warn("章节加载失败，以下章节文件未找到：", spineFiles.value[i]);
      continue;
    }
    const chapter = await resolveXhtmlResource(await file.async("string"), filePath);
    const blob = new Blob([chapter], { type: chapterLoadType.value });//使用blob代替字符串，更优雅
    const blobUrl = URL.createObjectURL(blob);
    chapters.value.push(blobUrl)
  }
  // chapters.value = await Promise.all(promises);//此时chapters更新，DOM会刷新
  console.log("所有章节加载完毕", chapters.value)
}

init();

const isLNovel = ref(false);
const bookRate = ref(1.4);//书籍开版/比例（高：宽），仅轻小说有效，默认1倍

//轻小说优化器
async function betterLNovel(index, iframe, chapterDoc) {

  const illusNames = ["插图", "插畫", "イラスト", "illustration", "Illustration", "彩插", "插画", "彩圖", "彩图", "illus", "彩页"];

  const title = chapterDoc.head.querySelector("title")?.textContent || "未命名章节";
  const imgs = chapterDoc.querySelectorAll("img,image")
  for (let i = 0; i < imgs.length; i++) {
    const imgEl = imgs[i];
    //计算图片显示尺寸
    const src = imgEl.getAttribute("src") || imgEl.getAttribute("xlink:href");

    await getImageResolution(src).then(size => {
      console.log("轻小说图片分辨率：", size);
      const imgRate = Math.round((size.width / size.height) * 100) / 100;
      console.log("计算图片开版比例：", imgRate);
      const isRoundBookRate = Math.abs(imgRate - bookRate.value) <= 0.1;
      let isTitleMatched = isRoundBookRate;
      if (!isTitleMatched) {
        for (let i = 0; i < illusNames.length; i++) {
          if (title.match(new RegExp(illusNames[i], "i"))) {
            isTitleMatched = true;
            console.log(`章节标题匹配到插画关键词${illusNames[i]}，应用插画优化`);
            break;
          }
        }
      }
      if (!isTitleMatched) {
        for (let i = 0; i < illusNames.length; i++) {
          let filename = spineFiles.value[index]
          if (filename.match(new RegExp(illusNames[i], "i"))) {
            isTitleMatched = true;
            console.log(`章节文件名匹配到插画关键词${illusNames[i]}，应用插画优化`);
            break;
          }
        }
      }
      if ((isTitleMatched && imgRate > 1)) {
        console.log("图片被标记为插画，应用双页尺寸优化");
        //说明该图片就是开本大小，且刚好占两页，直接这一章节改成双页尺寸
        setImgFullWidth(imgEl);
        console.log("图片开版比例与书籍开版比例相符，添加占位优化");
      }
    })
  }

  /* 此处的全屏逻辑：
  1.如果图片是img标签，那就把它的宽高设置成双页尺寸，并且设置object-fit:contain属性，让图片按比例缩放适应容器。
  但是在width-column机制中，这个图片在标准流中只有一页的宽度，那一页是溢出的，所以我做一个兄弟标签弄到img后边，
  他俩合起来占用双页，然后把生成一个它的父元素设置成块级元素，让其width:auto，这样一来就会自动被img+div撑开，
  撑大到两页宽度，这时这一栏就强行是双页宽度了，图片也能完整显示。
  注意：width-column布局中，行内元素（inline或inline-block）是不会撑开栏宽的，内容太长会被当成溢出，但Web流中只有一个栏目
  // 2.观测svg也撑不开
  */
  function setImgFullWidth(imgEl) {
    const placeholder = chapterDoc.createElement("div")
    placeholder.style.width = `${width.value / 2}px`
    placeholder.style.height = `${height.value}px`
    if (imgEl.tagName.toLowerCase() === "image") {
      if (imgEl.parentElement) {
        //那其父元素一定是svg标签
        imgEl.parentElement.style.height = `${height.value}px`;
        imgEl.parentElement.style.maxHeight = "none";
        imgEl.parentElement.style.width = `${width.value}px`;
        imgEl.parentElement.style.maxWidth = "none";
        imgEl.parentElement.after(placeholder)
      }
      return
    }
    //如果不是image，在这里设置img标签样式
    imgEl.style.width = `${width.value}px`;
    imgEl.style.maxWidth = "none";
    imgEl.style.height = `${height.value}px`;
    imgEl.style.maxHeight = "none";
    //这个属性让图片按比例缩放以适应容器，就是实际上宽高是我设置的宽高，但是真正图片会在img中适配显示
    imgEl.style.objectFit = "contain";
    if (imgEl.parentElement) {
      // 这里是如果图片的直接父元素不是块级元素，那可能会影响布局，把父元素也设置成块级元素。
      imgEl.parentElement.style.display = "block";
      imgEl.parentElement.style.height = "auto";
      imgEl.parentElement.style.width = "auto";
    }
    //占位标签：column只有一页大小，图片虽然是两页尺寸，
    // 但他在DOM中还是占用一页宽度，后面的内容会挤到图片右半部分上
    imgEl.after(placeholder);
  }



}

//该函数将css文本加上作用域前缀
function scopeCss(cssText, prefix) {
  // 1) 忽略不应当加作用域的 at-rules
  const skipAtRules = /@(font-face|keyframes|page|counter-style|import|namespace)/i;

  return cssText.replace(
    /(^|})(\s*[^{@][^{]*\s*)\{/g,   // 匹配：} 之后 或 文档开头，然后遇到一个“非 @ 的选择器块”
    (match, brace, selectorPart) => {
      const original = selectorPart.trim();

      // 如果是需要跳过的 @-rule，则原样返回
      if (skipAtRules.test(original)) {
        return match;
      }

      // 空选择器，比如可能出现的意外换行
      if (!original) return match;

      // 处理逗号分隔的多选择器
      const scoped = original
        .split(',')
        .map(sel => {
          sel = sel.trim();

          // 特殊：html、body 不要 prefix，避免选择失效
          if (/^(html|body)$/i.test(sel)) return sel;

          // 特殊：:root 也不加（否则变量全废）
          if (/^:root$/i.test(sel)) return sel;

          // 普通情况：前面加 prefix（注意空格）
          return `${prefix} ${sel}`;
        })
        .join(', ');

      return `${brace}\n${scoped} {`;
    }
  );
}

function prevChapter() {
  if (curChapterIndex.value > 0) {
    curChapterIndex.value--;
  }
}

function nextChapter() {
  if (curChapterIndex.value < spineFiles.value.length - 1) {
    curChapterIndex.value++;
  }
}

function nextPage() {
  const viewer = viewerRef.value;
  //判断是否滚动到尾部
  if (viewer.scrollLeft >= viewer.scrollWidth - viewer.clientWidth - 1) {
    // 滚动距离是否大于等于总宽度减去可见宽度-1,如果比这还大,说明已经滚动到尾部了
    console.log("已经滚动到尾部，翻到下一章节");
    return;
  }
  const pageWidth = viewer.clientWidth / 2; // 双页显示，每页宽度为容器宽度的一半
  viewer.scrollLeft += pageWidth;
}

function prevPage() {
  const viewer = viewerRef.value;
  //判断是否滚动到顶部
  if (viewer.scrollLeft <= 0) {
    console.log("已经滚动到顶部，翻到上一章节");
    return;
  }
  const pageWidth = viewer.clientWidth / 2; // 双页显示，每页宽度为容器宽度的一半
  viewer.scrollLeft -= pageWidth;
}

async function loadSpine(zip) {
  const containerXml = await zip.file("META-INF/container.xml").async("string");
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, "application/xml");
  const rootfilePath = containerDoc.querySelector("rootfile").getAttribute("full-path");
  console.log("rootfile路径：", rootfilePath);
  // 例如 "OEBPS/content.opf"
  const opfXml = await zip.file(rootfilePath).async("string");
  const opfDoc = parser.parseFromString(opfXml, "application/xml");

  // 获取 spine
  const spine = [...opfDoc.querySelectorAll("spine itemref")].map(itemref => itemref.getAttribute("idref"));

  // 获取 manifest 对应 href
  const manifest = {};
  opfDoc.querySelectorAll("manifest item").forEach(item => {
    manifest[item.getAttribute("id")] = item.getAttribute("href");
  });

  // spine 对应的实际文件列表
  const spineFiles = spine.map(idref => manifest[idref]);
  console.log(spineFiles); // ["Text/chapter1.xhtml", "Text/chapter2.xhtml"]。解析成功

  return [spineFiles, rootfilePath];
}

function relativePathToAbsolutePath(curFilePath, src) {
  console.log("原始资源路径：", src);
  //src是章节文件中引用的资源路径，如"../Images/pic1.jpg"
  //需要把它转换成zip中的路径，如"OEBPS/Images/pic1.jpg"
  const curDir = curFilePath.substring(0, curFilePath.lastIndexOf('/')).split('/');
  if (curDir.length == 1 && curDir[0] === "") {
    curDir.pop();//根目录特殊处理
  }
  console.log("当前章节文件目录：", curDir);
  //获取当前章节文件所在目录，如["OEBPS","Text"]
  src = src.replace("../", () => {
    //这地方可能有异常，找到顶层路径了还继续../，记得后面加上异常抛出
    curDir.pop();
    return "";
  }).replace("./", "");
  return curDir.join('/') + (curDir.length != 0 ? '/' : '') + src
}

//将章节文件中引用的资源路径转换得到blob路径
//参数：src：章节文件中引用的资源路径，如"../Images/pic1.jpg"
//     curFilePath：当前章节文件路径，如"OEBPS/Text/chapter1.xhtml
//     type：返回资源类型，默认blobUrl，还可以是string或blob
async function getResource(curFilePath, src, type = "blobUrl") {
  src = relativePathToAbsolutePath(curFilePath, src);
  //src现在是zip中的路径，如"OEBPS/Images/pic1.jpg"
  console.log("解析资源路径：", src);
  const file = zip.value.file(src);
  if (!file) {
    throw new ResourceNotFoundError(`资源未找到：${src}`);
  }

  if (type == "string") {
    const content = await file.async("string");
    return content;
  } else if (type == "blob") {
    const blob = await file.async("blob");
    return blob;
  } else {
    const blob = await file.async("blob");
    const blobUrl = URL.createObjectURL(blob);
    return blobUrl;
  }
}

//进度加载器
const readProcess = ref(0);
const totalPages = ref(0);
const currentPage = ref(0);
useScrollObserver(viewerRef, updatePagesParams);

function updatePagesParams(scrollInfo) {
  totalPages.value = Math.ceil(scrollInfo.scrollWidth / (width.value / 2));
  currentPage.value = Math.ceil((scrollInfo.scrollLeft + 1) / (width.value / 2)) + 1;
  readProcess.value = ((scrollInfo.scrollLeft + width.value) / scrollInfo.scrollWidth * 100).toFixed(2);
  console.log(`当前页码：${currentPage.value} / ${totalPages.value}，阅读进度：${readProcess.value}%`);
}

function loadPagesParams() {
  const viewer = viewerRef.value;
  totalPages.value = Math.ceil(viewer.scrollWidth / (width.value / 2));
  currentPage.value = Math.ceil((viewer.scrollLeft + 1) / (width.value / 2)) + 1;
  readProcess.value = ((viewer.scrollLeft + width.value) / viewer.scrollWidth * 100).toFixed(2);
  console.log(`当前页码：${currentPage.value} / ${totalPages.value}，阅读进度：${readProcess.value}%`);
}

//进度记录器
watch(readProcess, (newVal) => {
  if (!isRecovered.value) return;//未恢复进度前不记录
  localStorage.setItem("readProcess", newVal);
});

function skipToPage(pageNum) {
  const viewer = viewerRef.value;
  const pageWidth = viewer.clientWidth / 2; // 双页显示，每页宽度为容器宽度的一半
  viewer.scrollLeft = (pageNum - 1) * pageWidth;
}

const isRecovered = ref(false);
function recoverProcess() {
  const savedProcess = localStorage.getItem("readProcess");
  if (savedProcess) {
    console.log("恢复阅读进度：", savedProcess);
    const viewer = viewerRef.value;
    const scrollLeft = (parseFloat(savedProcess) / 100) * viewer.scrollWidth - width.value;
    viewer.scrollLeft = roundToNearestMultiple(scrollLeft, width.value / 2);
  }
  isRecovered.value = true;
}


const width = ref(0);
const height = ref(0);
useResizeObserver(viewerRef, (rect) => {
  console.log("阅读器容器尺寸变化：", rect);
  width.value = rect.width;
  height.value = rect.height;
  nextTick(() => {
    //等会儿DOM更新完毕再设置
    console.log("阅读器容器尺寸更新完毕，开始加载阅读器视图");
    loadViewer();
  });
});

const noteCards = ref([]);//注释卡片引用列表



const loadedChaptersCount = ref(0);//已加载章节计数
async function onIframeLoad(index, event, isReLoad = false) {
  console.log("设置章节容器样式：", index);
  //设置iframe样式，主要是阅读器尺寸
  const iframe = chaptersRef.value[index]
  iframe.style.height = `${height.value}px`;
  iframe.style.minWidth = `${width.value / 2}px`;
  iframe.style.overflow = "hidden";
  //设置iframe内文档样式
  const chapterEl = iframe;
  const doc = chapterEl.contentDocument

  //检测是否为轻小说格式
  if (index === 0) {    //获取封面页的，看是不是实际上只有一张图片
    const imgElements = doc.querySelectorAll("img,image");
    if (imgElements.length == 1) {
      // 标记为轻小说
      isLNovel.value = true;
      console.log("检测到轻小说格式，启用轻小说优化器");
      //获取图片分辨率，计算书籍开版比例
      const imgEl = imgElements[0];
      const src = imgEl.getAttribute("src") || imgEl.getAttribute("xlink:href");
      getImageResolution(src).then(resolution => {
        console.log("封面图片分辨率：", resolution);
        bookRate.value = (resolution.height / resolution.width).toFixed(1);
        console.log("计算书籍开版比例：", bookRate.value);
      }).catch(err => {
        console.warn("获取封面图片分辨率失败，轻小说模式已禁用");
        console.error(err.message);
        isLNovel.value = false;
      });
    }
  }

  //处理一下svg图片的比例缩放问题
  doc.querySelectorAll("svg").forEach(svgEl => {
    svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
  });

  //当.title没有文本时，去掉其样式的margin，防止标题换页时被截断
  const titleElements = doc.querySelectorAll(`.title`);
  titleElements.forEach(el => {
    if (!el.textContent.trim()) {
      el.style.margin = "0";
    }
  });
  //更正成双开大小
  const styleEl = doc.createElement("style");
  styleEl.textContent = `
      body {
        margin:0;
        padding:0;
        box-sizing: border-box;
        height: ${height.value}px;
        column-fill: auto;
        column-gap: 0px;
        column-width: ${width.value / 2}px;
        overflow: hidden;
      }
      svg,img,image{
        max-width: ${width.value / 2}px;
        max-height: ${height.value}px;
        object-fit: contain;
      }
    `;
  doc.head.append(styleEl);
  //这样追加的style在原样式后，会覆盖原有样式

  //特殊处理轻小说
  if (isLNovel.value) {
    console.log(`对${index}章节应用轻小说优化器`);
    await betterLNovel(index, iframe, doc);
  }

  //防止p标签超过宽度
  const strictPEl = doc.createElement("style");
  strictPEl.textContent = `
    p,h1,h2,h3,h4,h5 {
      max-width: ${width.value / 2}px;
    }
  `;
  doc.head.append(strictPEl);

  /* const pElements = doc.querySelectorAll("p");
  pElements.forEach(pEl => {
    pEl.style.maxWidth = `${width.value / 2}px`;
  }); */

  //防止横向滚动条出现
  console.log("当前章节body滚动宽度：", doc.body.scrollWidth)
  chapterEl.style.width = roundToNearestMultiple(doc.body.scrollWidth, width.value / 2) + "px";

  //处理超链接
  const linkElements = doc.querySelectorAll("a[href]");
  for (let i = 0; i < linkElements.length; i++) {
    const el = linkElements[i];
    el.setAttribute("target", "_top");//在浏览器地址栏打开链接
    const href = el.getAttribute("href");
    if (!href) continue;
    const id = href.startsWith("#") ? href.slice(1) : href;
    el.onclick = (e) => {
      console.log("点击了章节内超链接：", href);
      e.preventDefault();//阻止默认跳转行为
      if (href.startsWith("http://") || href.startsWith("https://")) {
        //外部链接，直接在新标签页打开
        window.open(href, '_blank');
        return
      }
      history.pushState(null, '', `#${id}`);
      const target = document.getElementById(id);
      if (target) {
        //立即跳转
        target.scrollIntoView({ behavior: 'instant', block: 'start' });
      } else {
        console.warn("未找到对应的锚点元素：", id);
      }
    }
  }

  loadPagesParams();//这个函数叫load最好听，因为它是加载章节时调用的，
  // 每加载一个章节就调用一次，更新总页数，可以在视图上让用户看出来在加载进度

  //尝试处理注释（兼容duokan注释）（重新加载时候不需要重复处理注释）
  if (isReLoad) return;
  //获取epub:type="noteref"的元素列表
  const noteRefElements = doc.querySelectorAll("a[epub\\:type='noteref'],a.duokan-footnote");
  if (noteRefElements.length > 0) console.log("找到注释引用元素：", noteRefElements);
  for (let i = 0; i < noteRefElements.length; i++) {
    const el = noteRefElements[i];
    //给注释引用元素绑定点击事件
    el.addEventListener("click", (e) => {
      const rect = getGlobalRect(iframe, el)
      console.log("注释引用元素全局位置：", rect);
      noteCards.value.forEach(noteCard => {
        if (noteCard.noteRef === el) {
          noteCard.noteRefRect = rect;//更新位置
          noteCard.isShow = !noteCard.isShow;
          console.log("切换注释卡片显示状态：", noteCard.isShow);
        }
      });
    });
    //找到其对应的注释元素
    const href = el.getAttribute("href");
    if (!href) {
      console.warn("外挂注释解析失败，以下注释引用元素缺少href属性，可能由书内js实现：", el);
      continue;
    }
    const noteId = href.startsWith("#") ? href.slice(1) : href;
    const noteEl = doc.getElementById(noteId);
    if (noteEl) {
      //在此处直接把样式复制到注释元素上
      inlineComputedStylesFiltered(noteEl);
      noteEl.querySelectorAll("script")?.forEach(scriptEl => scriptEl.remove());//移除脚本，防止注释内脚本执行
      noteCards.value.push({ "note": noteEl, "noteRef": el, "noteRefRect": getGlobalRect(iframe, el), "isShow": false });
    } else {
      console.warn("未找到对应的注释元素：", noteId);
    }
    //移除注释元素在DOM中的位置，防止其占用空间
    noteEl.remove();
  }
  console.log("当前注释卡片列表：", noteCards.value);

  doc.addEventListener("click", (e) => {
    //除了注释以外的地方点击都隐藏注释卡片
    if (!(e.target.closest("a[epub\\:type='noteref'],a.duokan-footnote")))
      hideAllNoteCards();
  })

  loadedChaptersCount.value++;
  if (loadedChaptersCount.value === spineFiles.value.length) {
    console.log("章节视图全部初始化加载完成！");
    recoverProcess();//恢复阅读进度
  }
}


const chaptersRef = ref([]);//章节容器引用
console.log("章节引用创建完毕")

function loadViewer() {
  if (loadedChaptersCount.value !== chapters.value.length) {
    console.log("章节尚未全部加载完毕，等待中...");
    return;//所有章节iframe未加载完毕就不执行
  }
  //设置章节容器双页显示
  console.log("chapterRef：", chaptersRef.value);
  for (let i = 0; i < chaptersRef.value.length; i++) {
    onIframeLoad(i, null, true);
  }

}

onUpdated(() => {
  // 只在必要时重新加载阅读器视图
  // console.log("视图更新完毕，重新加载阅读器视图");
  // loadViewer()
});

//xhtml资源解析函数（最先执行的函数）
async function resolveXhtmlResource(xhtml, curFilePath) {
  //资源类型列表
  const parseList = [
    { selection: "img", attrName: "src" },
    { selection: "image", attrName: "xlink:href" },
    { selection: "script", attrName: "src" },
    { selection: "link[rel='stylesheet']", attrName: "href", type: "text/css", postProcess: resolveCssResource },
  ]

  xhtml = xhtml.replace(/^\uFEFF/gi, "")
    .replace(/&#65279;/gi, "")
    .replace(/&#xFEFF;/gi, "");; //去掉BOM头

  const parser = new DOMParser();
  const doc = parser.parseFromString(xhtml, chapterLoadType.value);
  //处理各种资源
  for (let item of parseList) {
    const elements = doc.querySelectorAll(item.selection);
    console.log(`找到${item.selection}元素：`, elements.length);
    for (let i = 0; i < elements.length; i++) {
      console.log(`处理第${i}个${item.selection}元素`);
      const el = elements[i];
      const attrValue = el.getAttribute(item.attrName);//属性值一般就是url路径，可能是相对路径
      //非空才操作
      if (attrValue) {
        //先检查缓存列表
        if (blobResourceCache.value.has(relativePathToAbsolutePath(curFilePath, attrValue))) {
          console.log(`资源已缓存：`, attrValue);
          if (item.postProcess) {
            //有后处理函数：取出缓存对象的prefix和blobUrl
            const blobUrl = blobResourceCache.value.get(relativePathToAbsolutePath(curFilePath, attrValue));
            el.setAttribute(item.attrName, blobUrl);
            continue;//跳过后续处理
          }
          //无后处理函数：直接取出缓存的blobUrl
          el.setAttribute(item.attrName, blobResourceCache.value.get(relativePathToAbsolutePath(curFilePath, attrValue)));
          continue;//跳过后续处理
        }

        //有后续处理函数：使用后处理函数篡改资源内容后再设置属性
        if (item.postProcess) {
          try {
            console.log(`获取并后处理${item.type}资源：`, attrValue);
            const newValue = await item.postProcess(await getResource(curFilePath, attrValue, "string"), relativePathToAbsolutePath(curFilePath, attrValue), curFilePath);
            const blobUrl = URL.createObjectURL(new Blob([newValue], { type: 'text/css' }));
            blobResourceCache.value.set(relativePathToAbsolutePath(curFilePath, attrValue), blobUrl);
            //需要后处理最好缓存起来，省得在处理css时重复获取资源
            el.setAttribute(item.attrName, blobUrl);
          } catch (e) {
            console.log("后处理资源时出错：", e);
            if (e instanceof ResourceNotFoundError) {
              console.warn(e.message);
              //继续执行，不设置该属性
            } else {
              throw e;//其他异常继续抛出
            }
          }
        } else {
          //无后处理函数：直接获取资源blobUrl
          try {
            const blobUrl = await getResource(curFilePath, attrValue);
            blobResourceCache.value.set(relativePathToAbsolutePath(curFilePath, attrValue), blobUrl);
            //缓存图片等资源，避免重复获取
            el.setAttribute(item.attrName, blobUrl);
          } catch (e) {
            if (e instanceof ResourceNotFoundError) {
              console.warn(e.message);
              continue;//资源未找到就跳过，不设置该属性
            } else {
              throw e;//其他异常继续抛出
            }
          }
        }

      }
    }
  }

  //处理超链接
  const linkElements = doc.querySelectorAll("a[href]");
  for (let i = 0; i < linkElements.length; i++) {
    const el = linkElements[i];
    const href = el.getAttribute("href");
    if (href && !href.startsWith("http://") && !href.startsWith("https://") && !href.startsWith("#")) {
      //相对路径超链接，转换为绝对路径，并且改成锚点连接
      // 不太严谨，待完善
      const filePath = relativePathToAbsolutePath(curFilePath, href).replace(`${metadataOpfDir.value}/`, "");//去掉前面的OEBPS/
      el.setAttribute("href", `#${filePath}`);
    }
  }

  return doc.documentElement.outerHTML;
}

//css资源解析函数
async function resolveCssResource(css, curFilePath) {
  // 去掉注释
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");

  // --- 处理 url() ---
  const urlRegex = /url\(\s*['"]?(.*?)['"]?\s*\)/gi;
  let urlMatch;
  const urlMatches = [];
  while ((urlMatch = urlRegex.exec(css)) !== null) {
    const urlPath = urlMatch[1];
    urlMatches.push({ full: urlMatch[0], path: urlPath });
  }

  for (let m of urlMatches) {
    let blobUrl = m.path;
    //跳过data url和http url
    if (m.path.startsWith("data:") || m.path.startsWith("blob:")
      || m.path.startsWith("http://") || m.path.startsWith("https://")) {
      //data url不处理
      continue;
    }
    //删除res://协议
    if (m.path.startsWith("res://")) {
      m.path = m.path.replace("res://", "");
      css = css.replace(m.full, `url('${m.path}')`);
      continue;
    }

    const absolutePath = relativePathToAbsolutePath(curFilePath, m.path);
    if (blobResourceCache.value.has(absolutePath)) {
      console.log(`资源已缓存：`, m.path);
      blobUrl = blobResourceCache.value.get(absolutePath);
      css = css.replace(m.full, `url('${blobUrl}')`);
      continue;//跳过后续处理
    }
    try {
      blobUrl = await getResource(curFilePath, m.path);
      blobResourceCache.value.set(absolutePath, blobUrl);
    } catch (e) {
      if (e instanceof ResourceNotFoundError) {
        console.warn(`资源未找到：${m.path}`);
        blobUrl = m.path; // 原样放回
      } else {
        throw e;
      }
    }
    css = css.replace(m.full, `url('${blobUrl}')`);
  }

  // --- 处理 @import ---
  // 兼容：
  // @import "xx.css";
  // @import 'xx.css';
  // @import url(xx.css);
  const importRegex = /@import\s+(?:url\()?['"]?(.*?)['"]?\)?\s*;/gi;
  let importMatch;
  const importMatches = [];
  while ((importMatch = importRegex.exec(css)) !== null) {
    const importPath = importMatch[1];
    importMatches.push({ full: importMatch[0], path: importPath });
  }

  for (let m of importMatches) {
    let blobUrl = m.path;
    const absolutePath = relativePathToAbsolutePath(curFilePath, m.path);
    if (blobResourceCache.value.has(absolutePath)) {
      console.log(`资源已缓存：`, m.path);
      blobUrl = blobResourceCache.value.get(absolutePath);
      css = css.replace(m.full, `@import url('${blobUrl}');`);
      continue;//跳过后续处理
    }
    try {
      let linkedCss = await getResource(curFilePath, m.path, "string");
      console.log("获取到被import的css内容，开始递归处理：", absolutePath);
      linkedCss = await resolveCssResource(linkedCss, absolutePath);//递归处理被import的css资源
      const blob = new Blob([linkedCss], { type: 'text/css' });
      blobUrl = URL.createObjectURL(blob);
      blobResourceCache.value.set(absolutePath, blobUrl);
    } catch (e) {
      if (e instanceof ResourceNotFoundError) {
        console.warn(`资源未找到 @import：${m.path}`);
        blobUrl = m.path;
      } else {
        throw e;
      }
    }

    // 替换成标准格式 @import url('...');
    css = css.replace(m.full, `@import url('${blobUrl}');`);
  }

  //处理vw单位，因为iframe内vw单位是相对于iframe宽度的，这是非常宽的，这违背著书者原意
  const vwRegex = /([\d.]+)vw/g;
  css = css.replace(vwRegex, (match, p1) => { {
    const pxValue = (parseFloat(p1) / 100) * (width.value/2);
    return `${pxValue}px`;
  }});
  //将16em到20em的宽度样式去掉，防止章节宽度过大导致横向滚动条出现
  css=css.replace(
    /\bwidth\s*:\s*(1[6-9](?:\.\d+)?|20(?:\.0+)?)em\s*;?/gi,
    ''
  );

  return css;
}

//通过章节路径获取章节索引
function getChapterIndexByFilePath(filePath) {
  console.log("查找章节索引，章节路径：", filePath);
  for (let i = 0; i < spineFiles.value.length; i++) {
    if (`OEBPS/${spineFiles.value[i]}` === filePath) {
      console.log("找到章节索引：", spineFiles.value[i]);
      return i;
    }
  }
  return -1;//未找到
}

//将所有注释设置为隐藏
document.addEventListener("scroll", hideAllNoteCards, true);//捕获阶段监听滚动事件，防止滚动时注释位置错误

function hideAllNoteCards() {
  noteCards.value.forEach(noteCard => {
    noteCard.isShow = false;
  });
}

</script>
<template>
  <div class="buttonArea">
    <button @click="prevPage">上一页</button>
    {{ currentPage }} / {{ totalPages }}
    <button @click="nextPage">下一页</button>
  </div>
  <div ref="viewerRef" class="viewer">
    <template v-for="(noteCard, index) in noteCards" :key="index">
      <!-- 当v-for和v-if同时使用时，最好在外面套一层template，防止v-if拿不到noteCard -->
      <NoteCard v-if="noteCard?.isShow" :noteRefRect="noteCard.noteRefRect">
        <div v-html="noteCard.note.outerHTML"></div>
      </NoteCard>
    </template>
    <iframe @click="hideAllNoteCards" :id="spineFiles[index]" ref="chaptersRef" v-for="(chapter, index) in chapters"
      :key="index" class="xhtml" :src="chapter" @load="onIframeLoad(index, $event)"></iframe>
  </div>
</template>
<style scoped lang="less">
iframe {
  border: none;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.buttonArea {
  position: absolute;
  display: flex;
  justify-content: center;

  button {
    flex: 1;
    width: 100px;
    margin: 10px;
  }
}

.xhtml {
  white-space: normal;
  /* 保持正文换行 */
  vertical-align: top;
}

.viewer {
  width: 1120px; //A4纸宽度
  height: 900px;
  margin: 0 auto;
  // background-color: skyblue;
  white-space: nowrap; //防止章节div换行
  overflow: hidden;
  background-color: antiquewhite;

  div {
    vertical-align: top;
  }

}

.link-button {
  background: none;
  border: none;
  color: blue;
  text-decoration: underline;
  cursor: pointer;
}
</style>
