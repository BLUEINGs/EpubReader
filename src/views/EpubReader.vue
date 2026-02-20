<script lang="js" setup>
import RangeInput from '@/components/inputs/RangeInput.vue';
import EpubViewer from './EpubViewer.vue';
import PageSelector from '@/components/inputs/PageSelector.vue';
import PageRangeInput from '@/components/inputs/PageRangeInput.vue';
import Setting from './Setting.vue';
import Content from './Content.vue';
import { BookShelf } from '@/utils/BookShelf.js';
import { defaultReadOptions } from '@/utils/ConstantVars.js';
import { computed, ref, watch, watchEffect, toRaw, onBeforeMount } from 'vue';
const props = defineProps({
  hashCode: {
    type: String,
    required: true
  }
})
const currentPage = ref(1)
const totalPages = ref(0)
function setTotalPages(newTotal) {
  totalPages.value = newTotal
}

const showSetting = ref(false)

const options = ref(defaultReadOptions)
const metadata = ref({ title: "未知书籍" })


loadReadOptions()
/*
watchEffect(async () => {
  const bookShelf = new BookShelf()
  const book = await bookShelf.getBookMetadataByHashCode(props.hashCode)
  options.value = book.options
}) */
/* watchEffect函数会收集传入函数中用到的所有响应式变量，每当其变化就会执行函数 */

const showContent = ref(false)

async function loadReadOptions() {
  const bookShelf = new BookShelf()
  const book = await bookShelf.getBookMetadataByHashCode(props.hashCode)
  metadata.value = book
  options.value = book.options
}

const content = ref([])
const chapterPageStartList = ref([])//章节起始页列表，索引对应章节索引，值为该章节的起始页码
const curChapterIndex = ref(0)

</script>
<template>
  <div class="reader">
    <EpubViewer v-model:curChapterIndex="curChapterIndex" v-model:content="content" @update:totalPages="setTotalPages"
      v-model:currentPage="currentPage" :chapterPageStartList="chapterPageStartList" :hashCode="props.hashCode"
      class="viewer-core"></EpubViewer>
    <div class="buttonArea">
      <PageRangeInput :dir="options.pageDirection" class="page-range-input" name="currentPage"
        v-model:chapterPageStartList="chapterPageStartList" v-model:curChapterIndex="curChapterIndex"
        v-model="currentPage" min="1" :max="totalPages">
      </PageRangeInput>
      <button class="setting" @click="showSetting = !showSetting"></button>
      <button class="content" @click="showContent = !showContent"></button>
    </div>
    <Setting :hashCode="props.hashCode" v-model="options" v-if="showSetting"></Setting>
    <Content :hashCode="props.hashCode" :content="content" v-if="showContent"></Content>
  </div>
</template>
<style lang="less" scoped>


.reader {
  width: 100%;
  height: 100vh;

  h1 {
    position: fixed;
    left: 10px;
    top: 10px;
    font-size: 18px;
    font-weight: 400;
    color: rgb(53, 53, 53)
  }

  .viewer-core {
    width: 100%;
    height: 100%;
  }

  .buttonArea {
    display: flex;
    position: fixed;
    width: 80%;
    left: 50%;
    /* 移动到父宽度中点 */
    transform: translateX(-50%);
    /* 向左偏移自身宽度一半 */
    bottom: 0;
    align-items: center;

    .page-range-input {
      flex: 1;
    }

    .setting,
    .content {
      border: none;
      outline: none;
      margin: 0 10px;
      font-size: 24px;
      font-weight: bold;
      color: rgb(53, 53, 53);
      width: 48px;
      height: 48px;
      padding: 8px 16px;
      background: url('@/assets/icons/setting.svg') no-repeat center;
      border-radius: 24px;
      background-color: rgba(0, 0, 0, 0.2);
      background-size: 70% 70%;
      cursor: pointer;
    }

    .content {
      background: url('@/assets/icons/content.svg') no-repeat center;
      background-color: rgba(0, 0, 0, 0.2);
      background-size: 60% 60%;
    }
  }
}


@media screen and (max-width: 768px) {
  .reader {
    .buttonArea {
      width: 100%;
    }
  }
}
</style>
