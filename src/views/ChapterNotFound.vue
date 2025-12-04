<script setup lang="js">
import {defineProps} from "vue"

const props=defineProps({
  "title":String,
  "filePath":String
})
</script>
<template>
  <div class="chapter-not-found">
    <h2>{{ props.title }}</h2>
    <p>章节加载失败，以下章节文件未找到：<br>
      {{ props.filePath }}</p>
  </div>
</template>
<style scoped>
.chapter-not-found {
  text-align: center;
  margin-top: 50px;
  color: #888;
}
</style>
