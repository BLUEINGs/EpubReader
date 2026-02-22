<script setup lang="js">
import JSZip from "jszip";
import NoteCard from "@/components/NoteCard.vue";
import { useResizeObserver, useScrollObserver, useHashChangeObserver } from '../utils/useDOMObserver.js';
import { computed, onMounted, onUpdated, ref, watch, nextTick, toRaw } from 'vue';
import ResourceNotFoundError from '../utils/ResourceNotFoundError.js';
import { BookShelf, Book } from "@/utils/BookShelf.js"
import { useRoute } from 'vue-router'
import { waitForSvgLoad, roundToNearestMultiple, copyComputedStyle, inlineComputedStyles, inlineComputedStylesFiltered, getGlobalRect, getImageResolution } from "@/utils/utils.js";
import bus from "@/utils/Bus.js";
import { transitionDuration, defaultReadOptions, READING_MODE_SINGLE, READING_MODE_DOUBLE, READING_MODE_SCROLL, READING_MODE_AUTO } from "@/utils/ConstantVars.js";

import ChapterNotFound from "./ChapterNotFound.html?raw";
import WatchImgDialog from "@/components/dialogs/WatchImgDialog.vue";
//?raw是把html文件作为字符串导入

const route = useRoute()

/*
关于Promise对象：
1.Promise刚开始既不是成功，也不是失败，而是处于等待态pending（没有被确定）
2.当异步操作成功时，Promise对象的状态会变成fulfilled（成功），此时会调用then方法绑定的回调函数，函并将异步操作的结果作为参数传递给回调数。
3.当异步操作失败时，Promise对象的状态会变成rejected（失败），此时会调用catch方法绑定的回调函数，并将错误信息作为参数传
4.Promose的构造函数：
new Promise((resolve,reject)=>{
  构造时传入一个函数，该函数有两个参数，这两个参数也是函数类型，当函数体内调用resolve或者reject时，该Promise对象结果确定
})
关于await Promise：
1.await只能在async函数中使用，它会等待一个Promise对象的完成，并返回其的结果。
2.当await后面的Promise对象变为fulfilled时，await表达式会返回该Promise的结果。
3.如果Promise对象变为rejected，await表达式会抛出该Promise的错误信息。（直接在此处抛出异常，下面代码不走了）

*/

const zip = ref(null);//定义zip变量存放解压后的内容
const spineFiles = ref([]);//定义章节文件列表

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

const loadXHTMLByHTMLMode = computed(() => options.value.loadByHtml);//是否以html模式加载xhtml章节文件

const chapterLoadType = computed(() => {
  return loadXHTMLByHTMLMode.value ? "text/html" : "application/xhtml+xml"
})


const bookHash = ref("");//本书的HASH值，用于标识唯一书籍

const props = defineProps({
  hashCode: {
    type: String,
    required: true
  }
})

const options = ref(defaultReadOptions)

const metadata = ref({});//书籍metadata
//初始化：获取章节文件列表
const isInited = ref(false)
async function init() {
  // const response = await fetch('/test8.epub');//fetch函数是现代浏览器的HTTP请求，这是直接请求到"public/test.epub"了
  // const arrayBuffer = await response.arrayBuffer();
  //如果响应内容为一个文件，直接用arrayBuffer()方法把它读成二进制数据，Promise里面包的是二进制数据对象ArrayBuffer

  //异步计算HASH，然后确定书本ID。这里是我相信待会儿恢复阅读的时候这个值已经计算完毕了
  /* crypto.subtle.digest('SHA-256', arrayBuffer).then(hashBuffer => {
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    bookHash.value = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }); */

  // 书架实例
  const bookShelf = new BookShelf()
  const book = await bookShelf.getBookByHashCode(props.hashCode)
  const metadataValue = await bookShelf.getBookMetadataByHashCode(props.hashCode)
  metadata.value = metadataValue
  options.value = metadataValue.options
  // console.log("文件内容：",arrayBuffer)
  bookHash.value = props.hashCode
  // 解压
  zip.value = await JSZip.loadAsync(book.binary);
  const [spineFilesList, rootfilePath] = await loadSpine(zip.value);//获取章节文件列表
  //此处加载的章节文件列表是相对于metadata.opf的路径，如"Text/chapter1.xhtml"
  // （我最早在这儿写成全局路径不就没这么多事了，实在是难蚌）
  spineFiles.value = spineFilesList;
  metadataOpfPath.value = rootfilePath;
  //其实这个rootfilePath应该叫metadataPath更合适
  const lastIndex = rootfilePath.lastIndexOf('/')
  let rootDir = metadataOpfDir.value;//获取目录文件的路径，如"OEBPS"
  // console.log("章节文件位置：", rootDir);
  //并且加载章节

  //初始化阅读器样式
  viewerRef.value.style.transition = `all ${transitionDuration}ms ease`;
  reloadFactReadingMode()

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
    if (i == 0) {
      //加载首页时就开始判断
      await setIsLNovel(new DOMParser().parseFromString(chapter, "text/html"));
    }
    const blob = new Blob([chapter], { type: chapterLoadType.value });//使用blob代替字符串，更优雅
    const blobUrl = URL.createObjectURL(blob);
    chapters.value.push(blobUrl)
  }

  console.log("所有章节加载完毕")
  isInited.value = true
}

init();

const isLNovel = ref(false);
const bookRate = ref(1.4);//书籍开版/比例（高：宽），仅轻小说有效，默认1倍

//轻小说优化器
async function betterLNovel(index, iframe, chapterDoc, isReLoad = false) {

  const imgs = chapterDoc.querySelectorAll("img,image")

  if (isReLoad) {
    //如果是重新加载章节，就先移除旧的占位标签
    const oldPlaceholder = chapterDoc.querySelectorAll("div[img-placeholder]");
    if (oldPlaceholder) {
      for (let i = 0; i < oldPlaceholder.length; i++) {
        oldPlaceholder[i].remove()
      }
    }
  }

  for (let i = 0; i < imgs.length; i++) {
    const imgEl = imgs[i];
    //计算图片显示尺寸
    const src = imgEl.getAttribute("src") || imgEl.getAttribute("xlink:href");
    //处理双开图
    // 已加载图片，直接读
    //img标签本来就有onload事件，这是原生js事件。eg:<img onload="funcation" />
    let imgWidth;
    let imgHeight;
    // console.log("异步任务即将申请")
    await new Promise((resolve, reject) => {
      // console.log("异步任务已开始")
      if (imgEl.tagName == "image") {
        waitForSvgLoad(imgEl, chapterDoc.baseUrl, 7000).then(async () => {
          await getImageResolution(src).then(resolution => {
            imgWidth = resolution.width
            imgHeight = resolution.height
          }).catch(err => {
            reject()
            console.warn("svg图片加载失败");
          });
          resolve()
        })
      } else {
        if (imgEl.complete) {
          imgWidth = imgEl.naturalWidth
          imgHeight = imgEl.naturalHeight
          resolve()
        }
        imgEl.onload = () => {
          imgWidth = imgEl.naturalWidth
          imgHeight = imgEl.naturalHeight
          resolve()
        }
      }
      imgEl.onerror = () => {
        reject()
        throw new Error("图片加载失败")
      }
    })

    const imgRate = Math.round((imgWidth / imgHeight) * 100) / 100
    console.log("计算图片开版比例：", imgRate);

    //处理所有要全屏显示的所有插图（包括单页和双页的）（img图片没有内边距是轻小说优化器特有的，svg属于是原本就应该那样实现）
    if (isImgIllus(imgEl)) {
      console.log("图片被标记为插画(不分大小图)，应用全屏尺寸优化");
      if (imgEl.tagName.toLowerCase() != "image") {
        if (factReadingMode.value != READING_MODE_SCROLL) {
          imgEl.style.height = `${height.value}px`;
        } else {
          // if (options.value.compatibleMode) {
          // imgEl.style.height = `${(width.value / 2) / imgRate}px`
          // } else {
          imgEl.style.removeProperty("height")
          // }
        }
        imgEl.style.width = `${width.value / 2}px`;
      }
      if (imgEl.parentElement) {
        const parent = imgEl.parentElement;
        parent.style.display = "block";
        if (parent.tagName.toLowerCase() != "svg") {
          parent.style.height = "auto";
        }
        parent.style.padding = "0";
        if (parent.tagName.toLowerCase() == "p" && parent.children.length == 1) {
          parent.replaceWith(...parent.childNodes);//把p标签移除，直接用子节点替代
        }
      }
      imgEl.style.maxWidth = `${width.value / 2}`
      if (factReadingMode.value == READING_MODE_SCROLL) {
        imgEl.style.maxHeight = "none"
        //这行是滚动优化，滚动模式下如果一张插画比开版高度更高，可以让他完全放得下
      }
    }
    //处理双开图
    if ((isImgIllus(imgEl) && imgRate > 1)) {
      console.log("图片被标记为双页插画，应用双页尺寸优化");
      //说明该图片就是开本大小，且刚好占两页，直接这一章节改成双页尺寸

      if (isReLoad) {
        imgEl.style.removeProperty("position")
        imgEl.style.removeProperty("left")
        imgEl.style.removeProperty("top")
        if (imgEl.tagName == "image") {
          imgEl.parentElement.style.removeProperty("position")
          imgEl.parentElement.style.removeProperty("left")
          imgEl.parentElement.style.removeProperty("top")
        }
      }

      if (factReadingMode.value != READING_MODE_SCROLL) {
        setImgFullWidth(imgEl);
        imgEl.style.position = "relative";
        imgEl.style.top = `-${pagePadding.value}px`;
        imgEl.style.left = `-${pagePadding.value}px`;
        if (imgEl.tagName == "image") {
          imgEl.parentElement.style.position = "relative";
          imgEl.parentElement.style.top = `-${pagePadding.value}px`;
          imgEl.parentElement.style.left = `-${pagePadding.value}px`;
        }

        if (options.value.pageDirection == "rtl") {
          imgEl.style.left = `-${width.value / 2 + pagePadding.value}px`
          if (imgEl.tagName == "image") {
            imgEl.parentElement.style.left = `-${width.value / 2 + pagePadding.value}px`
          }
        }
      } else {
        imgEl.style.position = "relative";
        imgEl.style.left = `-${pagePadding.value}px`;
        if (imgEl.tagName == "image") {
          imgEl.parentElement.style.position = "relative";
          imgEl.parentElement.style.left = `-${pagePadding.value}px`;
        }
      }
    }

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
    placeholder.style.height = `${height.value - pagePadding.value * 2}px`
    placeholder.setAttribute("img-placeholder", "")
    if (imgEl.tagName.toLowerCase() === "image") {
      //那其父元素一定是svg标签
      imgEl.parentElement.style.height = `${height.value}px`;
      imgEl.parentElement.style.maxHeight = "none";
      imgEl.parentElement.style.width = `${width.value}px`;
      imgEl.parentElement.style.maxWidth = "none";
      // console.log("为",imgEl,"添加占位")
      imgEl.parentElement.after(placeholder)
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

async function removeBetterLNovel(index, chapterDoc) {
  //如果是重新加载章节，就先移除旧的占位标签
  const oldPlaceholder = chapterDoc.querySelectorAll("div[img-placeholder]");
  if (oldPlaceholder) {
    for (let i = 0; i < oldPlaceholder.length; i++) {
      oldPlaceholder[i].remove()
    }
  }

  const imgs = chapterDoc.querySelectorAll("img,image")
  let imgEl;
  for (let i = 0; i < imgs.length; i++) {
    imgEl = imgs[i]
    imgEl.style.removeProperty("width")
    imgEl.style.removeProperty("height")
    imgEl.style.removeProperty("max-width")
    imgEl.style.removeProperty("max-height")
    imgEl.style.removeProperty("position")
    imgEl.style.removeProperty("left")
    imgEl.style.removeProperty("top")
    if (imgEl.tagName == "image") {
      imgEl.style.removeProperty("position")
      imgEl.style.removeProperty("left")
      imgEl.style.removeProperty("top")
    }
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

async function loadSpine(zip) {
  const containerXml = await zip.file("META-INF/container.xml").async("string");
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, "application/xml");
  const rootfilePath = containerDoc.querySelector("rootfile").getAttribute("full-path");
  // console.log("rootfile路径：", rootfilePath);
  // 例如 "OEBPS/content.opf"
  const opfXml = await zip.file(rootfilePath).async("string");
  const opfDoc = parser.parseFromString(opfXml, "application/xml");

  // 获取 spine
  const spine = [...opfDoc.querySelectorAll("spine itemref")].map(itemref => itemref.getAttribute("idref"));

  // 获取 manifest 对应 href
  const manifest = {};
  opfDoc.querySelectorAll("manifest item").forEach(item => {
    manifest[item.getAttribute("id")] = {
      href: item.getAttribute("href"),
      mediaType: item.getAttribute("media-type"),
      properties: item.getAttribute("properties")
    };
  });

  const spineFiles = spine.map(idref => manifest[idref]?.href);
  console.log(spineFiles); // ["Text/chapter1.xhtml", "Text/chapter2.xhtml"]。解析成功

  const toc = await buildToc(zip, opfDoc, manifest, rootfilePath);
  content.value = toc
  return [spineFiles, rootfilePath, toc];
}

async function buildToc(zip, opfDoc, manifest, rootfilePath) {

  const parser = new DOMParser();
  const opfDir = rootfilePath.substring(0, rootfilePath.lastIndexOf("/") + 1);

  // EPUB3 检测
  const navItemEntry = Object.entries(manifest).find(([id, item]) => {
    return item.properties && item.properties.includes("nav");
  });

  if (navItemEntry) {
    const [navId, navItem] = navItemEntry;

    const navPath = opfDir + navItem.href;

    const fileObj = zip.file(navPath);
    if (!fileObj) {
      console.warn("⚠ nav 文件不存在于 zip 中:", navPath);
      return [];
    }

    const navXml = await fileObj.async("string");

    const navDoc = parser.parseFromString(navXml, "application/xhtml+xml");

    const allNavs = navDoc.querySelectorAll("nav");

    const tocNav = [...allNavs].find(nav =>
      nav.getAttribute("epub:type") === "toc" ||
      nav.getAttribute("type") === "toc"
    );

    if (!tocNav) {
      console.warn("⚠ 没找到 epub:type='toc'");
      return [];
    }


    const parseOl = (ol) => {
      return [...ol.children]
        .filter(li => li.tagName.toLowerCase() === "li")
        .map(li => {
          const a = li.querySelector(":scope > a");
          const subOl = li.querySelector(":scope > ol");

          return {
            label: a?.textContent?.trim() || "",
            href: a?.getAttribute("href") || "",
            children: subOl ? parseOl(subOl) : []
          };
        });
    };

    const rootOl = tocNav.querySelector("ol");

    const result = rootOl ? parseOl(rootOl) : [];
    return result;
  }

  console.log("未检测到 EPUB3 nav，尝试 EPUB2");

  //  EPUB2 检测
  const ncxEntry = Object.entries(manifest).find(([id, item]) => {
    return item.mediaType === "application/x-dtbncx+xml";
  });

  if (ncxEntry) {
    const [ncxId, ncxItem] = ncxEntry;
    const ncxPath = opfDir + ncxItem.href;
    const fileObj = zip.file(ncxPath);
    if (!fileObj) {
      console.warn("⚠ ncx 文件不存在于 zip 中:", ncxPath);
      return [];
    }
    const ncxXml = await fileObj.async("string");
    console.log("ncx 文件长度:", ncxXml.length);
    const ncxDoc = parser.parseFromString(ncxXml, "application/xml");
    const navMap = ncxDoc.getElementsByTagName("navMap")[0];
    if (!navMap) {
      console.warn("⚠ navMap 不存在");
      return [];
    }
    const parseNavPoint = (navPoint) => {
      const labelEl = navPoint.getElementsByTagName("text")[0];
      const contentEl = navPoint.getElementsByTagName("content")[0];
      const label = labelEl?.textContent?.trim() || "";
      const href = contentEl?.getAttribute("src") || "";
      const childNavPoints = [...navPoint.children]
        .filter(el => el.tagName === "navPoint")
        .map(parseNavPoint);
      return {
        label,
        href,
        children: childNavPoints
      };
    };

    const topNavPoints = [...navMap.children]
      .filter(el => el.tagName === "navPoint");
    const result = topNavPoints.map(parseNavPoint);
    return result;
  }

  console.warn("⚠ 未找到 nav 或 ncx，进入 fallback");

  const fallback = Object.entries(manifest)
    .filter(([id, item]) => item.mediaType === "application/xhtml+xml")
    .map(([id, item]) => ({
      label: item.href,
      href: item.href,
      children: []
    }));

  return fallback;
}



function relativePathToAbsolutePath(curFilePath, src) {
  // console.log("原始资源路径：", src);
  //src是章节文件中引用的资源路径，如"../Images/pic1.jpg"
  //需要把它转换成zip中的路径，如"OEBPS/Images/pic1.jpg"
  const curDir = curFilePath.substring(0, curFilePath.lastIndexOf('/')).split('/');
  if (curDir.length == 1 && curDir[0] === "") {
    curDir.pop();//根目录特殊处理
  }
  // console.log("当前章节文件目录：", curDir);
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
  // console.log("解析资源路径：", src);
  const file = zip.value.file(src);
  if (!file) {
    throw new ResourceNotFoundError(`资源未找到：${src}`);
  }

  if (type == "string") {
    const content = await file.async("string");
    return content;
  } else if (type == "blob") {
    const rawBlob = await file.async("blob");
    const typedBlob = new Blob([rawBlob], {
      type: getMimeType(src)
    })
    return typedBlob;
  } else {
    const rawBlob = await file.async("blob");
    const typedBlob = new Blob([rawBlob], {
      type: getMimeType(src)
    })
    const blobUrl = URL.createObjectURL(typedBlob);
    return blobUrl;
  }
}

function getMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase()

  const map = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
  }

  return map[ext] || "application/octet-stream"
}

//进度加载器
const readProcess = ref(0);
const totalPages = ref(0);
const currentPage = defineModel(
  "currentPage",
  {
    type: [Number, String],
    default: 2
  }
);

const isScrolling = ref(false)

const iframeWidthList = ref([])
const iframeHeightList = ref([])
useScrollObserver(viewerRef, updatePagesParams, { isScrolling, });

const emit = defineEmits(["update:totalPages"])

//这里的逻辑是滚动=>更新页码和进度
//该函数本意是希望更新页码以外的滚动更新
//滚动直接来源于：用户手动滚动、skipToPage函数的滚动（next/prePage函数、页码更新调用）
//现在在满足所有需求的条件下，只有一个情况真正用得上滚动监听器：
//也就是竖屏模式，竖屏模式以外的模式滚动监听器开不开都一样
function updatePagesParams(scrollInfo) {
  readProcess.value = getCurProcess(scrollInfo);
  if (bus.changePageByInput) {
    // bus.changePageByInput = false
    return
  }
  console.log("滚动信息：", {
    scrollLeft: scrollInfo.scrollLeft,
    scrollTop: scrollInfo.scrollTop,
    scrollWidth: scrollInfo.scrollWidth,
    scrollHeight: scrollInfo.scrollHeight,
    viewerWidth: scrollInfo.clientWidth,
  })
  if (factReadingMode.value != READING_MODE_SCROLL) {
    totalPages.value = Math.ceil(scrollInfo.scrollWidth / (width.value / 2));
    emit("update:totalPages", totalPages.value)
    if (options.value.pageDirection == "rtl") {
      //右开本需要反过来计算页码
      currentPage.value = Math.ceil((-scrollInfo.scrollLeft + 1) / (width.value / 2));
      // console.log("右开本，scrollLeft:", scrollInfo.scrollLeft, "计算得到页码：", currentPage.value);
    } else {
      currentPage.value = Math.ceil((scrollInfo.scrollLeft + 1) / (width.value / 2));
    }
  } else {
    totalPages.value = Math.ceil(scrollInfo.scrollHeight / height.value);
    emit("update:totalPages", totalPages.value)
    currentPage.value = Math.ceil((scrollInfo.scrollTop + 1) / height.value);
    readProcess.value = getCurProcess(scrollInfo);
  }
  console.log(`当前页码：${currentPage.value} / ${totalPages.value}`);
}

//更新页码=>滚动
//该函数本意是希望滚动以外的页码更新，不希望任何滚动带来的影响
//更新页码直接来源于：进度条拖拽、next/prePage函数（按钮或点击翻页）、updatePagesParams函数
// const currentPageWatched=ref(false)
watch(currentPage, () => {
  console.log("页码变化，新的页码：", currentPage.value);
  if (currentPage.value < 1) {
    currentPage.value = 1;
  } else if (currentPage.value > totalPages.value) {
    console.log("页码超过总页数，调整到最后一页");
    currentPage.value = totalPages.value;
  }
  console.log("当前页码变更是否来自控件：", bus.changePageByInput)
  if (!bus.changePageByInput) {
    return
  }
  /*
  如何识别拖条滚动？草？气晕了
  使用封装方法的方式或手动修改页面翻页是机器滚动，
  滚动鼠标滚轮是用户滚动
  */
  skipToPage(currentPage.value, true);
})

function getCurProcess(scrollInfo) {
  let chapterIndex = 0;
  let innerProcess = 0;
  if (factReadingMode.value != READING_MODE_SCROLL) {
    let totalWidth = 0
    let i = 0
    while (totalWidth < Math.abs(scrollInfo.scrollLeft) + (width.value / 2) - 5 && i < iframeWidthList.value.length) {
      totalWidth += iframeWidthList.value[i]
      i++//当前章节索引
    }
    chapterIndex = i - 1
    innerProcess = (iframeWidthList.value[chapterIndex] - (totalWidth - Math.abs(scrollInfo.scrollLeft))) / iframeWidthList.value[chapterIndex]
  } else {
    let totalHeight = 0
    let i = 0
    // console.log("scrollTop:", scrollInfo.scrollTop)
    while (totalHeight < scrollInfo.scrollTop + height.value - 5 && i < iframeHeightList.value.length) {
      totalHeight += iframeHeightList.value[i]
      i++//当前章节索引
    }
    chapterIndex = i - 1
    innerProcess = (iframeHeightList.value[chapterIndex] - (totalHeight - scrollInfo.scrollTop)) / iframeHeightList.value[chapterIndex]
  }


  return { chapterIndex: chapterIndex, innerProcess: innerProcess }
}

function loadPagesParams() {
  const viewer = viewerRef.value;
  updatePagesParams(viewer)
}

const curChapterIndex = defineModel("curChapterIndex", {
  type: [Number, String], default: 0
});

//进度记录器
watch(readProcess, async (newVal) => {
  if (!isRecovered.value) return;//未恢复进度前不记录
  curChapterIndex.value = newVal.chapterIndex;
  await new BookShelf().saveBookReadProcess(bookHash.value, toRaw(newVal));
  metadata.value.process = toRaw(newVal);//更新metadata中的进度数据，方便后续恢复进度时读取
});

const isRecovered = ref(false);
function recoverProcessOrRediact() {
  if (window.location.hash) {
    isRecovered.value = true
    const targetId = window.location.hash.slice(1);//去掉#号
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'instant', block: 'start', inline: "start" });
      window.location.hash = "";//清除hash，避免后续hash变化触发
    } else {
      recoverProcess()
      console.warn("未找到对应的锚点元素：", targetId, "已自动恢复到上次阅读进度");
    }
  } else {
    recoverProcess()
  }
}

function setReadingDirection() {
  viewerRef.value.dir = "normal";//先设置成默认ltr，避免之前的rtl设置影响到后续的scrollLeft计算
  if (options.value.pageDirection == "rtl") {
    viewerRef.value.dir = "rtl"
  }
}

useHashChangeObserver((hashValue) => {
  console.log("hash变化了，新的hash：", hashValue);
  if (!isRecovered.value || !hashValue || hashValue == "") {
    //如果还没恢复进度，恢复后自由逻辑跳转
    return
  } else {
    const targetId = hashValue.slice(1);//去掉#号
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      /*
      block: 'start'：将元素顶部与滚动容器顶部对齐。
      inline: "start"：将元素的左边缘与滚动容器的左边缘对齐（对于从左到右的文本）。如果是从右到左的文本，则将元素的右边缘与滚动容器的右边缘对齐。
      */
      targetEl.scrollIntoView({ behavior: 'instant', block: 'start', inline: "start" });
      window.location.hash = "";//清除hash，避免后续hash变化触发
    } else {
      console.warn("未找到对应的锚点元素：", targetId);
    }
  }
})

function recoverProcess() {
  const savedProcess = metadata.value.process;
  if (savedProcess) {
    console.log("阅读进度：", savedProcess);
    const viewer = viewerRef.value;
    if (factReadingMode.value != READING_MODE_SCROLL) {
      let scrollLeft = 0;
      for (let i = 0; i < savedProcess.chapterIndex; i++) {
        scrollLeft += iframeWidthList.value[i]
      }
      scrollLeft += savedProcess.innerProcess * iframeWidthList.value[savedProcess.chapterIndex];
      if (options.value.pageDirection == "rtl") {
        scrollLeft = -scrollLeft;//右开本需要反过来计算scrollLeft
      }
      viewer.scrollLeft = roundToNearestMultiple(scrollLeft, width.value / 2);
    } else {
      let scrollTop = 0;
      for (let i = 0; i < savedProcess.chapterIndex; i++) {
        scrollTop += iframeHeightList.value[i]
      }
      scrollTop += savedProcess.innerProcess * iframeHeightList.value[savedProcess.chapterIndex];
      viewer.scrollTop = roundToNearestMultiple(scrollTop, height.value);
    }

  }
  isRecovered.value = true;
}

function skipToPage(pageNum) {
  /*   if (!scrollFromUser) {
      scrollingByUser.value = false
    } */
  const viewer = viewerRef.value;
  if (factReadingMode.value == READING_MODE_SCROLL) {
    viewer.scrollTop = (pageNum - 1) * height.value;
  } else {
    let pageWidth = viewer.clientWidth;
    if (factReadingMode.value == READING_MODE_DOUBLE) {
      pageWidth /= 2;
    }
    if (options.value.pageDirection == "rtl") {
      //如果是rtl模式，页码是从右往左数的，所以跳转时要从右边计算scrollLeft
      console.log("RTL模式跳转，计算scrollLeft：", -(pageNum - 1) * pageWidth);
      viewer.scrollLeft = -(pageNum - 1) * pageWidth;
    } else {
      viewer.scrollLeft = (pageNum - 1) * pageWidth;
    }
  }
  // scrollingByUser.value=true
}

function nextPage() {
  if (currentPage.value >= totalPages.value) {
    console.log("已经是最后一页了");
    return
  }
  skipToPage(currentPage.value + 1, false);
}

function prevPage() {
  if (currentPage.value >= totalPages.value) {
    //页码异常
    console.warn("页码异常，调整到最后一页");
    skipToPage(totalPages.value - 2, false);
  }
  skipToPage(currentPage.value - 1, false);
}

const wapperRef = ref(null);//外层适配包裹容器引用
const autoBestFitEnabled = computed(() => {
  return options.value.bestFitEnabled
});//是否启用自动最佳适应
const width = ref(0);
const height = ref(0);
useResizeObserver(wapperRef, (rect) => {
  if (!isInited.value) {
    return
  }
  console.warn("阅读器容器尺寸变化：", rect);
  const oldWidth = width.value
  const oldHeight = height.value
  //viewRef尺寸变化->更新width和height（是给iframe用的）->加载阅读器视图
  setViewerSize(rect);
  if (document.querySelector("style[dynamic-iframe-style]")) {
    document.querySelector("style[dynamic-iframe-style]").remove();
  }
  const styleEl = document.createElement("style");
  styleEl.setAttribute("dynamic-iframe-style", "");
  if (factReadingMode.value == READING_MODE_SCROLL) {
    styleEl.textContent = `
        iframe {
          display: block;
          min-width: ${width.value / 2}px;
        }
      `
  } else {
    styleEl.textContent = `
        iframe {
          height: ${height.value}px;
          min-width: ${width.value / 2}px;
        }
      `
  }
  document.head.appendChild(styleEl);

  if (width.value == oldWidth && height.value == oldHeight) {
    //尺寸没有实际变化，不需要重新加载阅读器视图，直接
    console.log("尺寸未实际变化，无需重新加载阅读器视图")
    return
  }
  reLoadViewer();
});
/*
*/

function autoBestFit(rect) {
  console.log("autoBestFit函数被执行")
  const viewportRate = rect.width / rect.height;
  const factBookRate = factReadingMode.value == READING_MODE_DOUBLE ? bookRate.value : bookRate.value / 2;
  console.log("视口比例：", viewportRate);
  if (isLNovel.value) {
    //轻小说按书籍开版比例适应
    console.log("按轻小说书籍开版比例适应：", factBookRate);
    //这里bookRate>1可以单开也可以双开，但<1强制要求单开，我不想做那种抽象模式下的适配
    if (viewportRate < factBookRate) {
      //视口更高，按宽度适应
      width.value = Math.round(rect.width);
      height.value = Math.round(rect.width / factBookRate);
    } else {
      //视口更宽，按高度适应
      height.value = Math.round(rect.height);
      width.value = Math.round(rect.height * factBookRate);
    }
  } else {
    if (factReadingMode.value == READING_MODE_SCROLL) {
      if (viewportRate < factBookRate) {
        //视口更高，按宽度适应
        width.value = Math.round(rect.width);
        height.value = Math.round(rect.width / factBookRate);
      } else {
        //视口更宽，按高度适应
        height.value = Math.round(rect.height);
        width.value = Math.round(rect.height * factBookRate);
      }
    } else {
      width.value = Math.round(rect.width);
      height.value = Math.round(rect.height);
    }
  }
  console.log("自动最佳适应计算结果，阅读器尺寸：", { width: width.value, height: height.value });

  if (factBookRate < 1) {
    width.value *= 2;
  }
}

const imgIllusMap = ref(new Map());//插画图片映射表，键为imgEl，值为true/false
function isImgIllus(imgEl) {
  if (imgIllusMap.value.has(imgEl)) {
    return imgIllusMap.value.get(imgEl)
  }
  let isIllus = false;
  if (imgEl.tagName.toLowerCase() === "image") {
    const parent = imgEl.parentElement;
    isIllus = (parent.getAttribute("width") == "100%" || parent.style.width == "100%"
      || parent.getAttribute("height") == "100%" || parent.style.height == "100%")
  } else {
    console.log("加入判断")
    isIllus = (Math.abs(imgEl.scrollHeight - height.value + pagePadding.value * 2) <= 10) || (Math.abs(imgEl.scrollWidth - width.value / 2 + pagePadding.value * 2) <= 10);
    console.log("imgEl.scrollWidth:", imgEl.scrollWidth, ";width/2:", width.value / 2, ";pagePadding:", pagePadding.value)
    console.log("判定结果：", isIllus)
    console.log("img标签：", imgEl)
    if (!isIllus) {
      isIllus = (Math.abs(imgEl.scrollHeight - height.value) <= 10) || (Math.abs(imgEl.scrollWidth - width.value / 2) <= 10);
    }
  }
  imgIllusMap.value.set(imgEl, isIllus)
  return isIllus;
}

const noteCards = ref([]);//注释卡片引用列表

//处理页内边距
const pagePadding = computed(() => {
  return options.value.pagePadding
});//页内边距，单位px

function setViewerSize(rect = wapperRef.value.getBoundingClientRect()) {
  reloadFactReadingMode();
  if (autoBestFitEnabled.value) {
    //自动最佳适应逻辑
    console.log("启用自动最佳适应，重新计算阅读器尺寸");
    autoBestFit(rect);
  } else {
    console.log("未启用自动最佳适应，使用包裹容器尺寸作为阅读器尺寸:", rect);
    width.value = Math.round(rect.width);
    height.value = Math.round(rect.height);
    const factBookRate = factReadingMode.value == READING_MODE_DOUBLE ? bookRate.value : bookRate.value / 2;
    if (factBookRate < 1) {
      width.value *= 2;
    }
  }

  if (factReadingMode.value == READING_MODE_DOUBLE) {
    viewerRef.value.style.width = `${width.value}px`;
  } else {
    viewerRef.value.style.width = `${width.value / 2}px`;
  } /* else if (factReadingMode.value == READING_MODE_SCROLL) {
    viewerRef.value.style.width = `${width.value / 2}px`;
    setTimeout(() => {
      viewerRef.value.style.width = "auto";
    }, transitionDuration+1000);
  } */
  if (factReadingMode.value == READING_MODE_SCROLL) {
    viewerRef.value.style.height = rect.height + "px";
  } else {
    viewerRef.value.style.height = `${height.value}px`;
  }
}

const factReadingMode = ref(READING_MODE_DOUBLE);//实际使用的阅读模式，可能会根据自动适应结果调整

const loadedChaptersCount = ref(0);//已加载章节计数

async function setIsLNovel(coverDoc) {
  if (!coverDoc) {
    coverDoc = chaptersRef.value[0].contentDocument;
  }
  const imgElements = coverDoc.querySelectorAll("img,image");
  if (imgElements.length == 1) {
    // 标记为轻小说
    isLNovel.value = true;
    console.log("检测到轻小说格式，启用轻小说优化器");
    //获取图片分辨率，计算书籍开版比例
    const imgEl = imgElements[0];
    const src = imgEl.getAttribute("src") || imgEl.getAttribute("xlink:href");
    await getImageResolution(src).then(resolution => {
      // console.log("封面图片分辨率：", resolution);
      bookRate.value = ((resolution.width / resolution.height) * 2);
      console.log("计算书籍开版比例：", bookRate.value);
    }).catch(err => {
      console.warn("获取封面图片分辨率失败，轻小说模式已禁用");
      console.error(err.message);
      isLNovel.value = false;
    });

    if (options.value.lNovelEnabled == 0) {
      console.log("禁用轻小说优化器：轻小说阅读器已强制禁用");
      isLNovel.value = false;
    }
  } else if (options.value.lNovelEnabled == 2) {
    //如果是强制轻小说模式，就算不满足轻小说格式也启用轻小说优化器
    isLNovel.value = true;
    console.warn("强制启用轻小说优化器：无法判定轻小说，强制启用可能导致渲染异常");
  }
}

//目录
const content = defineModel("content", {
  type: Array,
  default: () => []
});//目录数据，格式[{title:"章节1",index:0},]

import cursor from "@/assets/icons/cursor.png"
async function onIframeLoad(index, event, isReLoad = false) {
  if (index != 0 && (width.value == 0 || height.value == 0)) {
    console.warn(`加载章节${index}时阅读器尺寸未确定，将延后加载`);
    setTimeout(() => {
      onIframeLoad(index, event, isReLoad)
    }, 500);
    return
  }

  console.log("设置章节容器样式：", index);
  //设置iframe样式，主要是阅读器尺寸。
  const iframe = chaptersRef.value[index]
  //设置iframe内文档样式
  const chapterEl = iframe;
  const doc = chapterEl.contentDocument
  iframe.style.transition = `all ${transitionDuration}ms ease`;

  if (index === 0) {    //获取封面页的，看是不是实际上只有一张图片
    //首次设置阅读器尺寸
    setViewerSize();
    //首次设置开本方向
    setReadingDirection();

    iframe.style.height = `${height.value}px`;
    iframe.style.minWidth = `${width.value / 2}px`;
    iframe.style.overflow = "hidden";


    if (document.querySelector("style[dynamic-iframe-style]")) {
      document.querySelector("style[dynamic-iframe-style]").remove();
    }
    const dynamicIframeStyleEl = document.createElement("style");
    dynamicIframeStyleEl.setAttribute("dynamic-iframe-style", "");
    if (factReadingMode.value == READING_MODE_SCROLL) {
      dynamicIframeStyleEl.textContent = `
        iframe {
          display: block;
          min-width: ${width.value / 2}px;
          // min-height:${options.value.compatibleMode ? height.value + "px" : "none"};
          height:${height.value}px;
        }
      `
    } else {
      dynamicIframeStyleEl.textContent = `
        iframe {
          height: ${height.value}px;
          min-width: ${width.value / 2}px;
        }
      `
    }
    document.head.appendChild(dynamicIframeStyleEl);

  }

  //更正成双开大小的style
  if (isReLoad) {
    //如果是重新加载章节，就先移除旧的style
    const oldStyleEl = doc.head.querySelector("style[page-style]");
    if (oldStyleEl) {
      oldStyleEl.remove();
    }
  }

  const pageStyleEl = doc.createElement("style");
  pageStyleEl.setAttribute("page-style", "");
  if (factReadingMode.value == READING_MODE_SCROLL) {
    pageStyleEl.textContent = `
      body {
        cursor: ${isClickToTurnPageEnabled.value ? "url(" + cursor + ") 16 16" : "auto"}, auto;
        margin:0;
        padding:0 ${pagePadding.value}px;
        box-sizing: border-box;
        width: ${width.value / 2}px;
        overflow: ${iframeScrollEnabled.value ? "scroll" : "hidden"};
        font-size:${options.value.fontSize}px;
      }
      svg,img,image{
        box-sizing: border-box;
        max-width: ${width.value / 2}px;
        max-height: ${height.value}px;
        object-fit: contain;
        transition:all ${transitionDuration}ms ease;
      }
    `;
  } else {
    pageStyleEl.textContent = `
      body {
        cursor: ${isClickToTurnPageEnabled.value ? "url(" + cursor + ") 16 16" : "auto"}, auto;
        margin:0 ${pagePadding.value}px;
        padding:0;
        box-sizing: border-box;
        width: ${width.value / 2 - pagePadding.value * 2}px;
        height: ${height.value}px;
        column-fill: auto;
        column-gap: ${pagePadding.value * 2}px;
        column-width: ${width.value / 2 - pagePadding.value * 2}px;
        padding-top:${pagePadding.value}px;
        padding-bottom:${pagePadding.value}px;
        overflow: ${iframeScrollEnabled.value ? "scroll" : "hidden"};
        font-size:${options.value.fontSize}px;
      }
      svg,img,image{
        max-width: ${width.value / 2}px;
        max-height: ${height.value}px;
        object-fit: contain;
        transition:all ${transitionDuration} ease;
      }
      /* p,h1,h2,h3,h4,h5,h6 {
        box-sizing: border-box;
        padding-left: ${pagePadding.value}px;
        padding-right: ${pagePadding.value}px;
      } */
    `;
  }

  doc.head.append(pageStyleEl);
  //这样追加的style在原样式后，会覆盖原有样式


  /*
  这里是一个插画页判断逻辑，img标签如果高度接近阅读器高度，就认为是插画页；
  svg标签则是作者指定会设置svg宽度/高度100%的情况
   */

  //处理插画图片，使其顶格显示（无论是否轻小说都会把使图片全屏显示）
  //滚动模式下不处理图片顶格，因为滚动模式下图片本来就不受分页限制了
  doc.querySelectorAll("img").forEach(imgEl => {
    if (isImgIllus(imgEl)) {
      if (imgEl.parentElement) {
        const parent = imgEl.parentElement;
        if (parent.tagName.toLowerCase() == "a") {
          //如果img的父元素是a标签，说明图片是超链接，给a标签也设置marginTop
          parent.style.position = "relative";
          if (factReadingMode.value != READING_MODE_SCROLL) {
            parent.style.top = `-${pagePadding.value}px`;
          } else {
            parent.style.removeProperty("top");
          }
          parent.style.left = `-${pagePadding.value}px`;
          return
        }
      }
      imgEl.style.position = "relative";
      if (factReadingMode.value != READING_MODE_SCROLL) {
        imgEl.style.top = `-${pagePadding.value}px`;
      } else {
        imgEl.style.removeProperty("top");
      }
      imgEl.style.left = `-${pagePadding.value}px`;
    }
  });

  //处理一下svg图片的比例缩放问题
  doc.querySelectorAll("svg").forEach(svgEl => {
    if (svgEl.getAttribute("width") == "100%" || svgEl.style.width == "100%") {
      svgEl.style.width = `${width.value / 2}px`
      svgEl.style.position = "relative"

    }
    if (svgEl.getAttribute("height") == "100%" || svgEl.style.height == "100%") {
      svgEl.style.height = `${height.value}px`
      svgEl.style.position = "relative"
    }
    if (factReadingMode.value != READING_MODE_SCROLL) {
      svgEl.style.top = `-${pagePadding.value}px`
    } else {
      svgEl.style.removeProperty("top")
    }
    svgEl.style.left = `-${pagePadding.value}px`
    svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
  });

  //当.title没有文本时，去掉其样式的margin，防止标题换页时被截断
  const titleElements = doc.querySelectorAll(`.title`);
  titleElements.forEach(el => {
    if (!el.textContent.trim()) {
      el.style.margin = "0";
    }
  });

  //处理文本标签的默认内边距
  /* if (isReLoad) {
    //如果是重新加载章节，就先移除旧的text-wrapper
    const oldWrappers = doc.querySelectorAll("span[text-wrapper]");
    oldWrappers.forEach(wrapper => {
      const parent = wrapper.parentElement;
      if (parent) {
        wrapper.replaceWith(...wrapper.childNodes);//把wrapper移除，直接用子节点替代
      }
    });
  }*/
  /* const textElements = doc.querySelectorAll("p,h1,h2,h3,h4,h5,h6");
  textElements.forEach(el => {
    let hasIllus = false;
    el.querySelectorAll("img,image").forEach(imgEl => {
      // console.log("检测文本标签内的图片：", imgEl);
      if (isImgIllus(imgEl)) {
        console.log("检测到文本标签内有插画图片，跳过添加内边距");
        //如果文本标签内有插画图片，就不加内边距了，直接返回
        hasIllus = true;
        return;
      }
    });
    if (hasIllus) return;
    const warpper = doc.createElement("span")
    warpper.style.paddingLeft = `${pagePadding.value}px`;
    warpper.style.paddingRight = `${pagePadding.value}px`;
    warpper.style.boxSizing = "border-box";
    warpper.style.display = "block";
    warpper.setAttribute("text-wrapper", "");
    el.replaceWith(warpper);//这个api是把warpper放到el位置，然后el移除。而不是把让原来的el=warpper
    warpper.appendChild(el);
  }); */

  //使文本选中更流畅
  doc.body.style.webkitUserSelect = "text";
  doc.body.style.userSelect = "text";
  doc.body.style.outline = "none";
  doc.body.setAttribute("tabindex", "-1");//使body可聚焦，防止选中文本后无法取消选中

  //设定开本方向
  if (isReLoad) {
    //如果是重新加载章节，就先移除旧的rtl-style
    const oldRtlStyleEl = doc.head.querySelector("style[rtl-style]");
    if (oldRtlStyleEl) {
      oldRtlStyleEl.remove();
    }
    doc.documentElement.dir = "normal";
  }
  if (options.value.pageDirection == "rtl") {
    console.log("设置开本方向为rtl");
    doc.documentElement.dir = "rtl";
    const rtlStyle = doc.createElement("style");
    rtlStyle.setAttribute("rtl-style", "");
    rtlStyle.textContent = `
      html[dir=rtl] *:not(html):not(body):not([dir]) {
        direction: ltr;
      }
    `;//仅仅使开版方向是rtl，其他元素仍然保持ltr，防止文本方向也变成rtl导致的排版混乱
    if (doc.head.firstChild) {
      doc.head.insertBefore(rtlStyle, doc.head.firstChild);
    } else {
      doc.head.appendChild(rtlStyle);
    }
    //最小干预
  }

  //特殊处理轻小说
  if (isLNovel.value) {
    console.log(`对${index}章节应用轻小说优化器`);
    await betterLNovel(index, iframe, doc, isReLoad);
  } else {
    await removeBetterLNovel(index, doc)
  }

  //防止p标签超过宽度
  const strictPEl = doc.createElement("style");
  strictPEl.textContent = `
    p,h1,h2,h3,h4,h5,h6,hr {
      max-width: ${width.value / 2}px;
    }
    hr {
      margin: 10px ${pagePadding.value}px;
    }
  `;
  doc.head.append(strictPEl);

  //防止横向滚动条出现
  if (!iframeScrollEnabled.value) {
    if (isReLoad) {
      //chapterEL就是iframe
      chapterEl.style.width = "auto";//先清空旧的宽度设置
    }
    // await new Promise(resolve => {
    // setTimeout(() => {
    const widthValue = roundToNearestMultiple(doc.body.scrollWidth, width.value / 2)
    if (factReadingMode.value == READING_MODE_SCROLL) {
      chapterEl.style.width = width.value / 2 + "px";
    } else {
      chapterEl.style.width = widthValue + "px";
    }
    chapterEl.style.height = `${height.value}px`;
    iframeWidthList.value[index] = widthValue;
    loadPagesParams();
    // resolve()
    // }, transitionDuration + 100)
    // })
    //注释部分充分等待动画后再设置宽度，防止动画导致的宽度计算错误，但是速度太慢了
  }

  //滚动模式下让所有iframe的高度都适应内容高度，防止出现竖向滚动条
  if (factReadingMode.value == READING_MODE_SCROLL) {
    // await new Promise(resolve => {
    setTimeout(() => {
      chapterEl.style.height = "auto";//先清空旧的高度设置
      const heightValue = doc.body.scrollHeight;
      console.log("准备适应body高度,", heightValue)

      // chapterEl.style.removeProperty("min-height");
      chapterEl.style.height = heightValue + "px";
      chapterEl.style.width = `${width.value / 2}px`;
      console.log("已给值：", chapterEl.style.height)
      iframeHeightList.value[index] = heightValue
      // resolve()
    }, transitionDuration + 100);
    //这里的目的是防止动画导致的高度计算错误，等动画结束后再设置成内容高度
    // }
    // )
  }

  //处理超链接
  const linkElements = doc.querySelectorAll("a[href]");
  for (let i = 0; i < linkElements.length; i++) {
    const el = linkElements[i];
    el.setAttribute("target", "_top");//在浏览器地址栏打开链接
    const href = el.getAttribute("href");
    if (!href) continue;
    const id = href.startsWith("#") ? href.slice(1) : href;
    el.onclick = (e) => {
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
        target.scrollIntoView({ behavior: 'instant', block: 'start', inline: "start" });
      } else {
        console.warn("未找到对应的锚点元素：", id);
      }
    }
  }

  loadPagesParams();//这个函数叫load最好听，因为它是加载章节时调用的，
  chapterPagesList.value[index] = calculateChapterPages(index);
  // 每加载一个章节就调用一次，更新总页数，可以在视图上让用户看出来在加载进度

  //尝试处理注释（兼容duokan注释）（重新加载时候不需要重复处理注释）
  if (isReLoad) return;
  //===============注意：此行往下重载时不执行================
  //获取epub:type="noteref"的元素列表
  const noteRefElements = doc.querySelectorAll("a[epub\\:type='noteref'],a.duokan-footnote");
  if (noteRefElements.length > 0) {
    for (let i = 0; i < noteRefElements.length; i++) {
      const el = noteRefElements[i];
      //给注释引用元素绑定点击事件
      el.addEventListener("click", (e) => {
        const rect = getGlobalRect(iframe, el)
        // console.log("注释引用元素全局位置：", rect);
        noteCards.value.forEach(noteCard => {
          if (noteCard.noteRef === el) {
            noteCard.noteRefRect = rect;//更新位置
            noteCard.isShow = !noteCard.isShow;
            // console.log("切换注释卡片显示状态：", noteCard.isShow);
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
  }

  //处理文档注释点击和翻页点击
  doc.addEventListener("click", (e) => {
    //除了注释以外的地方点击都隐藏注释卡片
    if (!(e.target.closest("a[epub\\:type='noteref'],a.duokan-footnote"))) {
      hideAllNoteCards();
    }
    if (e.target.closest("a[epub\\:type='noteref'],a.duokan-footnote")) {
      return
    }
    //处理点击翻页
    if (!isClickToTurnPageEnabled.value) {
      return;
    }
    const selection = iframe.contentWindow.getSelection();
    // 判断是否有文本被选中
    if (selection && selection.toString().length > 0) {
      return;
    }
    const clickX = iframe.getBoundingClientRect().left + e.clientX
    // console.log("章节文档点击事件，计算全局X位置：", clickX);
    // console.log("视口的宽", window.innerWidth);
    if (clickX < window.innerWidth / 2) {
      if (options.value.pageDirection == "rtl") {
        nextPage();
      } else {
        prevPage();
      }
    } else {
      if (options.value.pageDirection == "rtl") {
        prevPage();
      } else {
        nextPage();
      }
    }
  })

  //处理文档键盘翻页事件
  doc.addEventListener("keydown", (e) => {
    //按Esc键取消注释卡片显示
    if (e.key === "Escape") {
      hideAllNoteCards();
    }
    if (e.key === "ArrowLeft") {
      //默认事件是滚动页面，这里要阻止
      e.preventDefault();
      if (options.value.pageDirection == "rtl") {
        nextPage();
      } else {
        prevPage();
      }
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (options.value.pageDirection == "rtl") {
        prevPage();
      } else {
        nextPage();
      }
    }
  })

  loadedChaptersCount.value++;
  if (loadedChaptersCount.value === spineFiles.value.length) {
    console.log("章节视图全部初始化加载完成！");

    recoverProcessOrRediact();//恢复阅读进度
  }
}

const chapterPagesList = ref([]);//章节页数列表，索引对应章节索引，值为该章节的页数
const chapterPageStartList = defineModel("chapterPageStartList", {
  type: Array,
  default: () => []
})//章节起始页列表，索引对应章节索引，值为该章节的起始页码

watch(chapterPagesList, () => {
  console.log("章节页数列表更新：", chapterPagesList.value);
  let pageCount = 1;
  for (let i = 0; i < chapterPagesList.value.length; i++) {
    chapterPageStartList.value[i] = pageCount;
    pageCount += chapterPagesList.value[i];
  }
}, { deep: true }
)

const calculateChapterPages = (chapterIndex) => {
  const chapterWidth = iframeWidthList.value[chapterIndex] || width.value / 2;
  const chapterHeight = iframeHeightList.value[chapterIndex] || height.value;
  let pagesInChapter = 1;
  if (factReadingMode.value == READING_MODE_SCROLL) {
    pagesInChapter = Math.ceil(chapterHeight / height.value);
  } else {
    pagesInChapter = Math.ceil(chapterWidth / (width.value / 2));
  }
  return pagesInChapter;
}

const isClickToTurnPageEnabled = computed(() => options.value.clickToFlipEnabled);//是否启用点击翻页功能

const chaptersRef = ref([]);//章节容器引用

const isLoading = ref(false)
async function loadViewer() {
  if (isLoading.value) {
    return
  }
  // isLoading.value = true
  console.log("***加载开始***")
  console.log("当前章节加载数量：", loadedChaptersCount.value);
  if (loadedChaptersCount.value !== chapters.value.length) {
    console.log("章节尚未全部加载完毕，等待中...");
    return;//所有章节iframe未加载完毕就不执行
  }
  const loadTasks = [];
  for (let i = 0; i < chaptersRef.value.length; i++) {
    console.log(`加载第${i}章节视图`);
    loadTasks.push(onIframeLoad(i, null, true));
  }
  await Promise.all(loadTasks)
  console.log("***加载结束***")
  // isLoading.value = false;
}

//xhtml资源解析函数（最先执行的函数）
async function resolveXhtmlResource(xhtml, curFilePath) {
  //资源类型列表
  const parseList = [
    { selection: "img", attrName: "src", type: "image/png" },
    { selection: "image", attrName: "xlink:href", type: "image/png" },
    options.value.loadJsEnabled ? { selection: "script", attrName: "src" } : null,
    { selection: "link[rel='stylesheet']", attrName: "href", type: "text/css", postProcess: resolveCssResource },
  ]

  xhtml = xhtml.replace(/^\uFEFF/gi, "")
    .replace(/&#65279;/gi, "")
    .replace(/&#xFEFF;/gi, "");; //去掉BOM头

  const parser = new DOMParser();
  const doc = parser.parseFromString(xhtml, chapterLoadType.value);
  //处理各种资源
  for (let item of parseList) {
    if (!item) continue;//如果该资源类型被禁用，就跳过
    const elements = doc.querySelectorAll(item.selection);
    // console.log(`找到${item.selection}元素：`, elements.length);
    for (let i = 0; i < elements.length; i++) {
      // console.log(`处理第${i}个${item.selection}元素`);
      const el = elements[i];
      const attrValue = el.getAttribute(item.attrName);//属性值一般就是url路径，可能是相对路径
      //非空才操作
      if (attrValue) {
        //先检查缓存列表
        if (blobResourceCache.value.has(relativePathToAbsolutePath(curFilePath, attrValue))) {
          // console.log(`资源已缓存：`, attrValue);
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
            // console.log(`获取并后处理${item.type}资源：`, attrValue);
            const newValue = await item.postProcess(await getResource(curFilePath, attrValue, "string"), relativePathToAbsolutePath(curFilePath, attrValue), curFilePath);
            const blobUrl = URL.createObjectURL(new Blob([newValue], { type: item.type }));
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
      // console.log(`资源已缓存：`, m.path);
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
      // console.log(`资源已缓存：`, m.path);
      blobUrl = blobResourceCache.value.get(absolutePath);
      css = css.replace(m.full, `@import url('${blobUrl}');`);
      continue;//跳过后续处理
    }
    try {
      let linkedCss = await getResource(curFilePath, m.path, "string");
      // console.log("获取到被import的css内容，开始递归处理：", absolutePath);
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
  css = css.replace(vwRegex, (match, p1) => {
    {
      const pxValue = (parseFloat(p1) / 100) * (width.value / 2);
      return `${pxValue}px`;
    }
  });
  //将16em到20em的宽度样式去掉，防止章节宽度过大导致横向滚动条出现
  css = css.replace(
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
function closeAllDialog() {
  //关闭所有对话框

}

/* const needReloadViewer = ref([
  options.value.bestFitEnabled,
  options.value.clickToFlipEnabled,
  options.value.iframeScrollEnabled,
  options.value.loadJsEnabled,
  options.value.pagePadding,
  options.value.lNovelEnabled
]) */

watch(() => bus.curReadOptions, async (newOptions) => {
  options.value = newOptions;
  console.log("阅读器选项已更新，开始重新加载")
  //轻小说模式重新加载
  await setIsLNovel()
  console.log("1626行（重新加载阅读器选项）：isLNovel结果：", isLNovel.value)
  //尺寸重加载逻辑
  setViewerSize();//重写计算factReadingMode和viewerRef的尺寸
  viewerRef.value.style.backgroundColor = options.value.backgroundColor;
  reLoadViewer();
},
  { deep: true }
)

function reloadFactReadingMode() {
  if (options.value.readingMode == READING_MODE_AUTO) {
    const viewportRate = wapperRef.value.getBoundingClientRect().width / wapperRef.value.getBoundingClientRect().height;
    if (viewportRate > 1) {
      factReadingMode.value = READING_MODE_DOUBLE
    } else {
      factReadingMode.value = READING_MODE_SINGLE
    }
  } else {
    factReadingMode.value = options.value.readingMode
  }
  if (factReadingMode.value == READING_MODE_SCROLL) {
    viewerRef.value.style.overflowY = "scroll";
    viewerRef.value.style.overflowX = "hidden";
    // console.log(viewerRef.value.style);
    viewerRef.value.scrollLeft = 0;//切换到滚动模式后默认滚动到顶部，防止之前的双页模式滚动位置过大导致看不到内容
    viewerRef.value.style.scrollbarGutter = "stable";
  } else {
    viewerRef.value.style.overflow = "hidden";
    viewerRef.value.scrollTop = 0;
    viewerRef.value.style.removeProperty("scrollbar-gutter")
  }
  console.log("实际使用的阅读模式：", factReadingMode.value);
}

function reLoadViewer() {
  isRecovered.value = false
  setReadingDirection()
  loadViewer().then(() => {
    console.log("重新加载完成，恢复阅读进度")
    //重载完毕不等于DOM更新完毕，所以等DOM更新完毕再恢复阅读进度
    setTimeout(() => {
      updatePagesParams(viewerRef.value);
      recoverProcessOrRediact()
    }, transitionDuration + 100);//等过渡动画结束后再恢复阅读进度，防止过渡动画被跳转打断
    //其实主要是CSS有一个0.3s的过渡动画，等动画结束了再恢复阅读进度，这样才比较可靠
  });
}

//调试模式
const iframeScrollEnabled = computed(() => {
  return options.value.iframeScrollEnabled
});

</script>
<template>
  <div ref="wapperRef" class="fitWapper">
    <div ref="viewerRef" class="viewer">
      <!-- <h1>{{ metadata.title }}</h1> -->
      <iframe @click="hideAllNoteCards" :id="spineFiles[index]" ref="chaptersRef" v-for="(chapter, index) in chapters"
        :key="index" class="xhtml" :src="chapter" @load="onIframeLoad(index, $event)"></iframe>
    </div>
    <template v-for="(noteCard, index) in noteCards" :key="index">
      <!-- 当v-for和v-if同时使用时，最好在外面套一层template，防止v-if拿不到noteCard -->
      <NoteCard v-if="noteCard?.isShow" :noteRefRect="noteCard.noteRefRect">
        <div v-html="noteCard.note.outerHTML"></div>
      </NoteCard>
    </template>
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
  position: fixed;
  left: 0;
  bottom: 0;
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

.fitWapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100vh;
  //核心默认使用视口尺寸，该组件尺寸可直接被父组件调整覆盖样式

  .viewer {
    position: relative;
    margin: 0 auto;
    white-space: nowrap; //防止章节div换行
    // scrollbar-gutter: stable;
    //该属性可以保证为滚动条预留空间，防止滚动条出现时内容宽度变化导致的闪烁，但目前只有chrome支持，等其他浏览器支持后可以考虑启用
    //由于本项目高度依赖自己计算的width，该属性很容易引起冲突，导致翻页无法正常进行
    // overflow: hidden;
    background-color: antiquewhite;
    transition: all 0.2s ease;

    h1 {
      position: fixed;
      left: 10px;
      top: 10px;
      font-size: 18px;
      font-weight: 400;
      color: rgb(53, 53, 53)
    }

    iframe {
      transition: all 0.2s ease;
    }

    div {
      vertical-align: top;
    }

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
