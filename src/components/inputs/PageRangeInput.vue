<script setup lang="js">
import RangeInput from './RangeInput.vue';
import PageSelector from './PageSelector.vue';
import { computed } from 'vue';
import bus from "@/utils/Bus.js"

const props = defineProps({
  max: {
    type: [Number, String],
    required: true
  },
  min: {
    type: [Number, String],
    default: 0
  },
  name: {
    type: String,
    required: true
  },
  dir: {
    type: String,
    default: "ltr"
  }
})
const value = defineModel({
  type: [Number, String],
  default: 0,
  required: true
})

const curChapterIndex = defineModel("curChapterIndex", {
  type: [Number, String],
  default: -1,
})

const chapterPageStartList = defineModel("chapterPageStartList", {
  type: Array,
  default: () => []
})

const showChapterSwitch = computed(() => {
  return curChapterIndex.value != -1 && chapterPageStartList.value.length > 0
})
/* 关于watchAPI的执行顺序：
旧值
  ↓
响应式值发生变化（新值已写入）
  ↓
watch 回调执行（拿到 newVal / oldVal）
*/
/* watch(value,()=>{

}) */

function nextChapter() {
  changePage()
  if (curChapterIndex.value < chapterPageStartList.value.length - 1) {
    value.value = chapterPageStartList.value[curChapterIndex.value + 1]
  } else {
    console.log("已经是最后一章了")
  }
}

function prevChapter() {
  changePage()
  if (curChapterIndex.value > 0) {
    value.value = chapterPageStartList.value[curChapterIndex.value - 1]
  } else {
    console.log("已经是第一章了")
  }
}

function nextPage() {
  changePage()
  value.value++
}

function prevPage() {
  changePage()
  value.value--
}

function handleChange() {
  changePage()
}

function changePage() {
  bus.changePageByInput = true
  setTimeout(() => {
    bus.changePageByInput = false
  }, 300)
}

function handleValueUpdate(pageValue) {
  changePage()
  value.value = pageValue
}
</script>
<template>
  <!-- :属性=""，这个写法里面写得其实是“js表达式”，里面必须是一个合法js表达式，换句话说里面写的一定是代码，比如下面这行，加``变成模板字符串就算是合法表达式 -->
  <div :dir="props.dir" class="slider-input">
    <button v-if="showChapterSwitch" class="pre" @click="prevChapter">&lt;&lt;</button>
    <button class="pre" @click="prevPage">&lt;</button>
    <PageSelector v-model:selectedPage="value" :totalPages="props.max"></PageSelector>
    <RangeInput @change="handleChange" :direcation="props.dir" :value="value" @update:value="handleValueUpdate"
      :max="props.max" :min="props.min" :name="props.name">
    </RangeInput>
    <button class="next" @click="nextPage">&gt;</button>
    <button v-if="showChapterSwitch" class="next" @click="nextChapter">&gt;&gt;</button>
  </div>
</template>
<style lang="less" scoped>
.slider-input {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 8px 16px;
  max-width: 100%;
  height: 48px;
  border-radius: 24px;
  background-color: rgba(0, 0, 0, 0.2);

  button {
    border: none;
    outline: none;
    margin: 0 10px;
    font-size: 24px;
    font-weight: bold;
    color: rgb(53, 53, 53);
    background: transparent;
    cursor: pointer;

    &.setting {
      width: 32px;
      height: 32px;
      color: rgb(53, 53, 53);
      background: url('@/assets/icons/setting.svg') no-repeat center;
      background-size: contain;
    }
  }

  span {
    font-size: 14px;
    font-weight: bold;
    color: rgb(53, 53, 53);
    margin-right: 10px;
  }
}

@media screen and (max-width:768px) {
  .slider-input {
    span {
      font-size: 8px;
      font-weight: bold;
      color: rgb(53, 53, 53);
      margin-right: 10px;
    }

    button {
      border: none;
      outline: none;
      margin: 0 4px;
      font-size: 18px;
      font-weight: bold;
      color: rgb(53, 53, 53);
      background: transparent;
      cursor: pointer;
    }
  }


}
</style>
