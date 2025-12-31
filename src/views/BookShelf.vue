<script lang="js" setup>
import { ref } from 'vue'
import { BookShelf, Book } from "@/utils/BookShelf.js"
// 创建书架实例
const bookShelf = new BookShelf()
// 存放所有书的 metadata
const booksList = ref([])
// 上传文件处理
async function handleUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  // 读取文件为 ArrayBuffer
  const arrayBuffer = await file.arrayBuffer()

  // 用文件名做 title，hashCode 用简单示例，可用 SHA-256
  const hashCode = file.name + file.size  // 临时示例
  const title = file.name
  const avator = "" // 暂时空
  const process = 0

  const book = new Book(hashCode, arrayBuffer, title, avator, process)

  // 存入 BookShelf
  bookShelf.putNewBook(book)

  // 更新列表
  loadAllBooks()
}

// 加载所有书
async function loadAllBooks() {
  try {
    const list = await bookShelf.getAllBooks()
    booksList.value = list
  } catch (err) {
    console.error(err)
  }
}

// 页面挂载时先加载
loadAllBooks()
</script>

<template>
  <div>
    <input type="file" @change="handleUpload" />
    <h3>书架列表：</h3>
    <ul>
      <li v-for="book in booksList" :key="book.id || book.hashCode">
        {{ book.title }} | process: {{ book.process }}
      </li>
    </ul>
  </div>
</template>

<style lang="less">
ul {
  list-style: none;
  padding: 0;
}
li {
  padding: 4px 0;
  border-bottom: 1px solid #eee;
}
</style>
