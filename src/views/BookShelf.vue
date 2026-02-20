<script lang="js" setup>
import { ref, computed } from 'vue'
import { BookShelf, Book } from "@/utils/BookShelf.js"
import { useRouter } from 'vue-router'
import BookCard from '@/components/BookCard.vue'
import JSZip from 'jszip'
import { loadSpineAndInfos } from "@/utils/EpubLoader.js"
import SHA256 from "crypto-js/sha256";
import WordArray from "crypto-js/lib-typedarrays";

const router = useRouter()

// 书架实例
const bookShelf = new BookShelf()

// 所有书
const booksList = ref([])

// UI 状态
const sortBy = ref('putTime') // putTime | title
const sortDir = ref('desc') // asc | desc
const bulkMode = ref(false)
const selected = ref([]) // 存放 hashCode

// 计算 SHA-256
async function calcSHA256(arrayBuffer) {
  // 优先使用原生 Web Crypto（需要 HTTPS）
  if (crypto?.subtle?.digest) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
  }

  // 降级方案：使用 CryptoJS
  const wordArray = WordArray.create(arrayBuffer)
  return SHA256(wordArray).toString()
}

// 上传文件
async function handleUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  const arrayBuffer = await file.arrayBuffer()
  const hashCode = await calcSHA256(arrayBuffer)
  const zip = await JSZip.loadAsync(arrayBuffer);
  const [spineFilesList, infos, rootfilePath] = await loadSpineAndInfos(zip);
  const book = new Book(hashCode, arrayBuffer, infos.cover, infos.title, infos.author, 0, Date.now(), infos.abstract, infos.tags)

  await bookShelf.putNewBook(book)
  await loadAllBooks()

  // 清空 input，避免同文件无法再次上传
  event.target.value = ''
}

// 删除单本书籍（接收 book 对象或 {hashCode}）
async function handleDelete(book) {
  if (!confirm('确定要删除这本书吗？')) return
  await bookShelf.removeBook(book)
  await loadAllBooks()
}

// 批量删除
async function handleBulkDelete() {
  if (!selected.value.length) return alert('未选中任何书籍')
  if (!confirm(`确定要删除 ${selected.value.length} 本书吗？`)) return
  for (const h of [...selected.value]) {
    await bookShelf.removeBook({ hashCode: h })
  }
  selected.value = []
  bulkMode.value = false
  await loadAllBooks()
}

// 加载书架
async function loadAllBooks() {
  try {
    booksList.value = await bookShelf.getAllBooks() || []
  } catch (e) {
    console.error(e)
  }
}

// 打开书籍：记录为上次阅读然后跳转
async function openBook(book) {
  try {
    await bookShelf.touchBook(book.hashCode)
  } catch (e) {
    console.warn('更新上次阅读失败', e)
  }
  router.push({ name: 'EpubReader', params: { hashCode: book.hashCode } })
}

// 选择相关
function toggleSelect(hash) {
  const idx = selected.value.indexOf(hash)
  if (idx === -1) selected.value.push(hash)
  else selected.value.splice(idx, 1)
}

function selectAll() {
  if (selected.value.length === booksList.value.length) selected.value = []
  else selected.value = booksList.value.map(b => b.hashCode)
}

// 排序后的数组
const sortedBooks = computed(() => {
  const arr = [...booksList.value]
  arr.sort((a, b) => {
    let res = 0
    if (sortBy.value === 'title') {
      res = (a.title || '').localeCompare(b.title || '')
    } else {
      res = (a.putTime || 0) - (b.putTime || 0)
    }
    return sortDir.value === 'asc' ? res : -res
  })
  return arr
})

// 上次阅读的一本（按 putTime 排序）
const lastBook = computed(() => sortedBooks.value[0] || null)

// 初始加载
loadAllBooks()
</script>

<template>
  <div class="bookshelf">
    <div class="toolbar">
      <div class="left">
        <input class="file-input" type="file" @change="handleUpload" />
      </div>
      <div class="right">
        <label class="ctrl">排序
          <select v-model="sortBy">
            <option value="putTime">放入时间</option>
            <option value="title">名称</option>
          </select>
        </label>
        <button class="icon-btn" @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'">{{ sortDir === 'asc' ? '升序' :
          '降序' }}</button>
        <label class="ctrl bulk">
          <input type="checkbox" v-model="bulkMode" /> 批量操作
        </label>
        <button v-if="bulkMode" class="small" @click="selectAll">全/取消选</button>
        <button v-if="bulkMode" class="danger" @click="handleBulkDelete">删除所选 ({{ selected.length }})</button>
      </div>
    </div>

    <div v-if="lastBook" class="last-card" @click="openBook(lastBook)">
      <img class="last-cover" :src="lastBook.cover || 'default-cover.png'" alt="cover" />
      <div class="last-info">
        <h2 class="last-title">{{ lastBook.title }}</h2>
        <div class="authorAndTags">
          <p class="last-author">{{ lastBook.author || '未知作者' }}</p>
          <div class="last-tags">
            <span v-for="(t, i) in lastBook.tags || []" :key="i" class="tag">{{ t }}</span>
          </div>
        </div>
        <p v-html="lastBook.abstract" class="last-abstract"></p>
        <div class="last-meta-row">
          <div class="progress">阅读进度：{{ lastBook.process || 0 }}%</div>
          <div class="puttime">放入时间：{{ new Date(lastBook.putTime || 0).toLocaleString() }}</div>
        </div>
      </div>
    </div>

    <div v-if="sortedBooks.length" class="shelf-grid">
      <div v-for="book in sortedBooks" :key="book.hashCode" class="grid-item">
        <label v-if="bulkMode" class="select-box">
          <input type="checkbox" :checked="selected.includes(book.hashCode)"
            @change.stop="toggleSelect(book.hashCode)" />
        </label>
        <BookCard :book="book" @open-book="openBook(book)" />
      </div>
    </div>

    <p v-else class="empty">书架还是空的</p>
  </div>
</template>


<style lang="less">
.bookshelf {
  max-width: 980px;
  margin: 28px auto;
  padding: 20px;
  background: linear-gradient(180deg, #ffffff, #fbfdff);
  border-radius: 14px;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px
}

.toolbar .left {
  flex: 1
}

.file-input {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px dashed #e6eef8;
  background: #fbfdff
}

.toolbar .right {
  display: flex;
  gap: 10px;
  align-items: center
}

.ctrl {
  font-size: 13px;
  color: #374151
}

.ctrl select {
  margin-left: 6px;
  padding: 4px 8px
}

.icon-btn {
  background: #eef2ff;
  border: none;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer
}

.small {
  background: #eef0ff;
  border: none;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer
}

.danger {
  background: #ffefef;
  border: none;
  color: #b91c1c;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer
}

.last-card {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 16px;
  border-radius: 10px;
  background: linear-gradient(90deg, #ffffff, #f8fbff);
  cursor: pointer;
  margin-bottom: 18px
}

.last-cover {
  width: 140px;
  height: 180px;
  object-fit: cover;
  border-radius: 8px
}

.last-info {
  flex: 1
}

.last-title {
  margin: 0;
  font-size: 20px;
  color: #0f172a
}

.authorAndTags {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 6px 0;

  .last-author {
    margin: 6px 0;
    color: #6b7280
  }

  .last-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 6px 0
  }
}



.last-abstract {
  color: #374151;
  max-height: 56px;
  overflow: hidden;
  text-overflow: ellipsis;
  overflow-y: scroll;
}

.last-meta-row {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  color: #6b7280;


}

.tag {
  background: #eef2ff;
  color: #374151;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 12px
}

.shelf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px
}

.grid-item {
  position: relative
  // width:150px;
}

.select-box {
  position: absolute;
  left: 8px;
  top: 8px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.85);
  padding: 4px;
  border-radius: 6px
}

.small-del {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer
}

.empty {
  color: #9aa4b2;
  text-align: center;
  padding: 40px 0
}
</style>
