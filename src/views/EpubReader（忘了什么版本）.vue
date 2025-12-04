<script setup lang="js">
import JSZip from "jszip";
import { useResizeObserver } from '../js/useDOMObserver.js.js';
import { computed, onMounted, onUpdated, ref, watch, watchEffect } from 'vue';
import ResourceNotFoundError from '../js/ResourceNotFoundError.js';
import { useRoute } from 'vue-router'
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
const curChapterIndex = ref(localStorage.getItem("curChapterIndex") ? parseInt(localStorage.getItem("curChapterIndex")) : 0);//当前章节索引
const curChapterFilePath = computed(() => {
  return `OEBPS/${spineFiles.value[curChapterIndex.value]}`;
});//当前章节文件路径
const curChapter = ref("章节加载中...");//当前章节内容

const blobResourceCache = ref(new Map());//资源缓存列表，键为资源路径，值为blobUrl

const prefix = ref("") //css作用域前缀

//读取当前章节内容
watchEffect(async () => {
  if (curChapterIndex.value < 0 || curChapterIndex.value >= spineFiles.value.length) {
    curChapter.value = "章节加载中...";
    return;
  }

  const file = zip.value.file(`OEBPS/${spineFiles.value[curChapterIndex.value]}`);
  if (file) {
    curChapter.value = await resolveXhtmlResource(await file.async("string"), `OEBPS/${spineFiles.value[curChapterIndex.value]}`);
  } else {
    curChapter.value = "章节资源缺失，加载失败";
  }
});

watch(
  () => route.fullPath, // 或者 route.path
  (newPath, oldPath) => {
    const parts = newPath.split('#')
    const last = parts[parts.length - 1]
    console.log('URL 最后一段变化了：', last)

    // 根据最后一段做操作
    spineFiles.value.forEach((file, index) => {
      if (file === last) {
        curChapterIndex.value = index
      }
    })
  },
  { immediate: true }// 立即执行一次，以初始化状态
)
//保存当前章节索引到本地存储，以便下次打开时继续上次阅读
watch(curChapterIndex, (newVal, oldVal) => {
  localStorage.setItem("curChapterIndex", newVal);
});
const viewerRef = ref(null);//阅读器容器引用

//初始化：获取章节文件列表
async function init() {
  const response = await fetch('/test.epub');//fetch函数是现代浏览器的HTTP请求，这是直接请求到"public/test.epub"了
  const arrayBuffer = await response.arrayBuffer();
  //如果响应内容为一个文件，直接用arrayBuffer()方法把它读成二进制数据，Promise里面包的是二进制数据对象ArrayBuffer

  // 解压
  zip.value = await JSZip.loadAsync(arrayBuffer);

  spineFiles.value = await loadSpine(zip.value);//获取章节文件列表
}

init();

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
    nextChapter();
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
    prevChapter();
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

  return spineFiles;
}

function relativePathToAbsolutePath(curFilePath, src) {
  console.log("原始资源路径：", src);
  //src是章节文件中引用的资源路径，如"../Images/pic1.jpg"
  //需要把它转换成zip中的路径，如"OEBPS/Images/pic1.jpg"
  const curDir = curFilePath.substring(0, curFilePath.lastIndexOf('/')).split('/');
  console.log("当前章节文件目录：", curDir);
  //获取当前章节文件所在目录，如["OEBPS","Text"]
  src = src.replace("../", () => {
    //这地方可能有异常，找到顶层路径了还继续../，记得后面加上异常抛出
    curDir.pop();
    return "";
  }).replace("./", "");
  return curDir.join('/') + '/' + src
}

//将章节文件中引用的资源路径转得到blob路径
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

const width = ref(0);
const height = ref(0);
useResizeObserver(viewerRef, (rect) => {
  console.log("阅读器容器尺寸变化：", rect.width, rect.height);
  width.value = rect.width;
  height.value = rect.height;
  loadViewer();
});

function loadViewer() {
  //防止元素移除容器
  const elements = document.querySelectorAll(`${prefix.value} img,svg`);
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    el.style.maxHeight = `${height.value}px`;
    el.style.maxWidth = `${width.value / 2}px`;//双页显示
    // el.style.boxSizing = "border-box";
  }

  //当.title没有文本时，去掉其样式的margin，防止标题换页时被截断
  const titleElements = document.querySelectorAll(`${prefix.value} .title`);
  titleElements.forEach(el => {
    if (!el.textContent.trim()) {
      el.style.margin = "0";
    }
  });

  //设置双页显示样式
  viewerRef.value.style.columnFill = "auto";
  viewerRef.value.style.columnGap = `0px`;
  viewerRef.value.style.columnWidth = `${width.value / 2}px`;//双页显示
}

onUpdated(() => {
  loadViewer()
});


//xhtml资源解析函数（最先执行的函数）
async function resolveXhtmlResource(xhtml, curFilePath) {
  //资源类型列表
  const parseList = [
    { selection: "img", attrName: "src" },
    { selection: "image", attrName: "xlink:href" },
    { selection: "link[rel='stylesheet']", attrName: "href", type: "text/css", postProcess: resolveCssResourceAndScope }
  ]

  const parser = new DOMParser();
  const doc = parser.parseFromString(xhtml, "application/xhtml+xml");
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
          el.setAttribute(item.attrName, blobResourceCache.value.get(relativePathToAbsolutePath(curFilePath, attrValue)));
          continue;//跳过后续处理
        }

        //有后续处理函数：使用后处理函数篡改资源内容后再设置属性
        if (item.postProcess) {
          try {
            console.log(`获取并后处理${item.type}资源：`, attrValue);
            const newValue = await item.postProcess(await getResource(curFilePath, attrValue, "string"), relativePathToAbsolutePath(curFilePath, attrValue));
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
      //相对路径超链接，转换为绝对路径
      const filePath = relativePathToAbsolutePath(curFilePath, href).replace("OEBPS/", "");//去掉前面的OEBPS/
      el.setAttribute("href", `#${filePath}`);
    }
  }

  return doc.documentElement.outerHTML;
}

//css资源解析函数
async function resolveCssResource(css, curFilePath) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");//去掉注释
  //该匹配项整个都算一个组，()里面的内容是第1组
  const parseList = [
    { partten: /url\(['"]?(.*?)['"]?\)/i, groupIndex: 1 }
  ]
  for (let item of parseList) {
    let match;
    const regex = new RegExp(item.partten, 'g');//全局匹配
    const blobUrls = [];//存放所有资源的blobUrl
    const matches = [];//存放所有匹配结果
    while ((match = regex.exec(css)) !== null) {
      matches.push(match);
      //match可以匹配的内容如： ["url('../Images/pic1.jpg')","../Images/pic1.jpg"]，分别是第0组和第1组
      const resourcePath = match[item.groupIndex];
      try {
        const blobUrl = await getResource(curFilePath, resourcePath)
        blobUrls.push(blobUrl);
      } catch (e) {
        if (e instanceof ResourceNotFoundError) {
          console.warn(`资源未找到：${resourcePath}`);
          blobUrls.push(resourcePath);//未找到资源就原样放回去
        } else {
          throw e;//其他异常继续抛出  }
        }
      }
      //替换
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const blobUrl = blobUrls[i];
        css = css.replace(match[0], `url('${blobUrl}')`);
      }
    }
  }
  return css;
}

async function resolveCssResourceAndScope(css, curFilePath) {
  const resolvedCss = await resolveCssResource(css, curFilePath);
  crypto.randomUUID().replace(/-/g, "").slice(0, 6);//生成一个随机字符串，用于css作用域前缀
  prefix.value = `#reader-${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;
  viewerRef.value.setAttribute("id", prefix.value.slice(1));//设置阅读器容器id，扣掉前面的#
  return scopeCss(resolvedCss, prefix.value);
}

</script>
<template>
  <div class="buttonArea">
    <button @click="prevPage">上一页</button>
    <button @click="nextPage">下一页</button>
  </div>
  <div ref="viewerRef" class="viewer">
    <div class="xhtml" v-html="curChapter"></div>
  </div>
</template>
<style scoped lang="less">
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


.viewer {
  width: 1120px; //A4纸宽度
  height: 800px;
  margin: 0 auto;
  background-color: skyblue;
  overflow: hidden;

  div {
    height: 100%;
  }
}

.viewer div {
  height: 100% !important;
}


.link-button {
  background: none;
  border: none;
  color: blue;
  text-decoration: underline;
  cursor: pointer;
}
</style>
