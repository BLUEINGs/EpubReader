<script setup lang="js">
defineProps({
  book: {
    type: Object,
    required: true
  }
})
const emit = defineEmits(['open-book'])
function handleOpenBook() {
  // 触发父组件事件，打开书籍
  emit('open-book')
}
</script>
<template>
  <div @click="handleOpenBook()" class="book-card">
    <div class="cover-wrap">
      <img :src="book.cover || 'default-cover.png'" alt="Book cover" class="book-cover" />
    </div>
    <div class="meta">
      <h4 class="book-title" :title="book.title">{{ book.title }}</h4>
      <p class="book-author">{{ book.author || '未知作者' }}</p>
      <div class="tags" v-if="book.tags && book.tags.length">
        <span v-for="(t, i) in book.tags" :key="i" class="tag">{{ t }}</span>
      </div>
      <div class="progress-bar">
        <div class="progress" :style="{ width: (book.process || 0) + '%' }"></div>
      </div>
    </div>
  </div>
</template>
<style scoped lang="less">
.book-card {
  cursor: pointer;
  width: 140px;
  height: 280px;
  background: linear-gradient(180deg, #ffffff, #fbfdff);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 6px 18px rgba(19, 35, 56, 0.06);
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    transform: translateY(-6px);
    box-shadow: 0 10px 30px rgba(19, 35, 56, 0.12);
  }

  .cover-wrap {
    flex: 1 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .book-cover {
    width: 120px;
    height: 168px;
    object-fit: cover;
    border-radius: 8px;
  }

  .meta {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .book-title {
    font-size: 14px;
    color: #111827;
    line-height: 1.2;
    height: 34px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .book-author {
    font-size: 12px;
    color: #6b7280;
  }

  .tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap
  }

  .tag {
    background: #eef2ff;
    color: #374151;
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 11px
  }

  .progress-bar {
    height: 6px;
    background: #f1f5f9;
    border-radius: 6px;
    overflow: hidden
  }

  .progress {
    height: 100%;
    background: linear-gradient(90deg, #4f46e5, #06b6d4)
  }
}
</style>
