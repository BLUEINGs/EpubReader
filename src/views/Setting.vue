<script setup lang="js">
import RadioInput from '@/components/inputs/RadioInput.vue';
import IOInput from '@/components/inputs/IOInput.vue';
import { BookShelf } from '@/utils/BookShelf.js';
import { defaultReadOptions, ABSOULTE_DISENBALED, AUTO_ENABLED, ABSOLUTEENABLED,READING_MODE_SINGLE, READING_MODE_DOUBLE, READING_MODE_SCROLL, READING_MODE_AUTO } from '@/utils/ConstantVars.js';
import bus from '@/utils/Bus.js';
import { computed, ref, watch, watchEffect, toRaw, onBeforeMount } from 'vue';
const options = defineModel("modelValue", {
  type: Object,
  default: () => {
    return defaultReadOptions
  },
  required: true
})

const props = defineProps({
  hashCode: {
    type: String,
    required: true
  }
})
/* definModel的默认写法如上*/

const needReLoad = ref([
  "loadJsEnabled",
  "lNovelEnabled",
  "loadByHtml"
])

const oldJsLoad = ref(options.value.loadJsEnabled)
const oldLNovel = ref(options.value.lNovelEnabled)
const oldLoadByHtml = ref(options.value.loadByHtml)

watch(
  options,
  //注意：这个options最早是EpubReader里面查库得到的，引用地址跟bus里面的不一样，需要手动赋值给bus
  async (newVal, oldVal) => {
    // console.log("1监听到options变化，新的值：", newVal, "旧的值：", bus.curReadOptions);
    bus.curReadOptions = newVal
    newVal = toRaw(newVal)
    await new BookShelf().saveBookOptions(props.hashCode, newVal)
    if (oldJsLoad.value != newVal.loadJsEnabled
      || oldLNovel.value != newVal.lNovelEnabled
      || oldLoadByHtml.value != newVal.loadByHtml) {
      // console.log("2监听到loadJsEnabled选项变化，新的值：", newVal.loadJsEnabled, "旧的值：", oldVal.loadJsEnabled);
      window.location.reload();
    }
  },
  { deep: true }
)
/*
| watch 第一个参数类型           | deep: true 内部属性变化触发？ |
| ----------------------- | -------------------- |
| reactive 对象引用           | ❌ 不触发（没 getter）      |
| getter 函数返回 reactive 对象 | ✅ 触发                 |
| ref                     | ✅ 触发（内部对象 reactive）  |
看好，如果想用deep:true，watch的第一个参数只能是getter或是ref，而不能是reactive

*/
</script>
<template>
  <div class="setting-panel">
    <h2>设置</h2>
    <ul class="options">
      <li>启用自动最佳开版适配<IOInput v-model="options.bestFitEnabled"></IOInput>
      </li>
      <li>阅读模式<RadioInput v-model="options.readingMode" :options="{
        '自动': READING_MODE_AUTO,
        '单页': READING_MODE_SINGLE,
        '双页': READING_MODE_DOUBLE,
        '滚动': READING_MODE_SCROLL
      }"></RadioInput>
      </li>
      <li>启用点击翻页<IOInput v-model="options.clickToFlipEnabled"></IOInput>
      </li>
      <li>纸张颜色<input type="color" v-model="options.backgroundColor"></input>
      </li>
      <li>强兼容模式（以HTML渲染）<IOInput v-model="options.loadByHtml"></IOInput>
      </li>
      <li>调试模式<IOInput v-model="options.iframeScrollEnabled"></IOInput>
      </li>
      <li>启用JavaScript加载<IOInput v-model="options.loadJsEnabled"></IOInput>
      </li>
      <li>页边距<input type="number" v-model="options.pagePadding" min="0" max="100"></input>px
      </li>
      <hr>
      <li>轻小说增强器<RadioInput v-model="options.lNovelEnabled" :options="{
        '禁用': ABSOULTE_DISENBALED,
        '自动': AUTO_ENABLED,
        '启用': ABSOLUTEENABLED
      }"></RadioInput>
      </li>
    </ul>
  </div>
</template>
<style lang="less" scoped>
.setting-panel {
  box-sizing: border-box;
  position: absolute;
  top: 0;
  left: 0;
  width: 400px;
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
