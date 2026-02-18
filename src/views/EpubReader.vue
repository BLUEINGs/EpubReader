<script lang="js" setup>
import RangeInput from '@/components/inputs/RangeInput.vue';
import EpubViewer from './EpubViewer.vue';
import PageSelector from '@/components/inputs/PageSelector.vue';
import PageRangeInput from '@/components/inputs/PageRangeInput.vue';
import Setting from './Setting.vue';
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

loadReadOptions()
/*
watchEffect(async () => {
  const bookShelf = new BookShelf()
  const book = await bookShelf.getBookMetadataByHashCode(props.hashCode)
  options.value = book.options
}) */
/* watchEffect函数会收集传入函数中用到的所有响应式变量，每当其变化就会执行函数 */

async function loadReadOptions() {
  const bookShelf = new BookShelf()
  const book = await bookShelf.getBookMetadataByHashCode(props.hashCode)
  options.value = book.options
}

</script>
<template>
  <div class="reader">
    <EpubViewer @update:totalPages="setTotalPages" v-model:currentPage="currentPage" :hashCode="props.hashCode"
      class="viewer-core"></EpubViewer>
    <div class="buttonArea">
      <PageRangeInput class="page-range-input" name="currentPage" v-model:value="currentPage" min="1" :max="totalPages">
      </PageRangeInput>
      <button class="setting" @click="showSetting = !showSetting"></button>
    </div>
    <Setting :hashCode="props.hashCode" v-model="options" v-if="showSetting"></Setting>
  </div>
</template>
<style lang="less" scoped>
.reader {
  width: 100%;
  height: 100vh;

  .viewer-core {
    width: 100%;
    height: 100%;
  }

  .buttonArea {
    display: flex;
    position: absolute;
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

    .setting {
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
  }
}
</style>
