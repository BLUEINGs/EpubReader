import { inlineComputedStyles, getGlobalRect } from "@/js/utils.js";
//多看阅读器注释解析器
function duoKanFootNoteParser(iframe,noteCards){
  const doc=iframe.contentDocument;
  const noteRefElements = doc.querySelectorAll("a.duokan-footnote");
  console.log("找到注释引用元素：", noteRefElements);
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
        }
      });
    });
    //找到其对应的注释元素
    const href = el.getAttribute("href");
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

export { duoKanFootNoteParser };
