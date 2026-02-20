<script setup lang="js">
import { computed, ref, watch, watchEffect, toRaw, onMounted, onBeforeUnmount } from 'vue';
const props = defineProps({
  hashCode: {
    type: String,
    required: true
  },
  content: {
    type: Array,
    default: () => []
  }
})

function scrollToContent(e) {
  const target = e.target;
  if (target.tagName.toLowerCase() === "a" && target.getAttribute("href").startsWith("#") && target.getAttribute("item") != null) {
    const href = target.getAttribute("href");
    e.preventDefault();//阻止默认跳转行为
    //跳转到对应章节
    const targetId = href.slice(1);//去掉#号
    const targetEl = document.getElementById(targetId);
    targetEl.scrollIntoView({ behavior: 'instant', block: 'start', inline: "start" });
    /*
    关于scrollIntoView与scrollTo以及整个渲染滚动的抽象模型：
    1.视口不是任何DOM元素，视口是浏览器可视区域（框子），
    2.HTML(DOCUMENT)是整个DOM流，也就是内容（报纸）
    3.scroll等于拿着报纸在框子上下左右滚动（也可以相对的反过来认为）（管他底层实现是什么）
    4.scrollIntoView的运作目的是让被调用对象尽可能出现在视口中特定处，其运作逻辑可以看作：
    (1)找到被调用元素（target）嘴上一级可滚动容器（overflow:visible以外的容器）
    (2)把这个父容器（parent）中target的位置信息和尺寸拿到，算出它到父滚动容器的绝对距离，把target滚动过去
    (3)递归此过程，直到递归到document，然后再把document按照算出来与视口window的距离滚动过去
    5. scrollTo是直接拿着报纸在框子里滚动，就是整个HTML(DOCUMENT)在滚动，scrollTo的参数是相对于视口window的坐标（也就是相对于框子的位置）
        */
    window.location.hash = "";
  }
}

onMounted(() => {
  document.addEventListener("click", scrollToContent)
})

onBeforeUnmount(() => {
  document.removeEventListener("click", scrollToContent)
})


const menu=ref(null)
function handleClickOutside(event) {
  if (menu.value && !menu.value.contains(event.target)) {
    console.log('点击了元素外部！')
    // 在这里触发你的函数
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>
<template>
  <div class="setting-panel" ref="menu">
    <h2>目录</h2>
    <ul class="content-list">
      <li v-for="(item, index) in props.content" :key="index"><a item :href="`#${item.href}`">{{ item.label }}</a></li>
    </ul>
  </div>
</template>
<style lang="less" scoped>
.setting-panel {
  box-sizing: border-box;
  position: fixed;
  top: 0;
  left: 0;
  width: 400px;
  max-width:80%;
  height: 100vh;
  padding: 20px;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 0 20px 20px 0;

  ul {
    list-style: none;

    li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 20px 0;
    }
  }
}
</style>
