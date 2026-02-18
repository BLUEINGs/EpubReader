import { defaultReadOptions } from "./ConstantVars.js";
export class BookShelf {

  static instance
  constructor() {
    if (!BookShelf.instance) {
      BookShelf.instance = this
    } else {
      return BookShelf.instance
    }

    if (navigator.storage && navigator.storage.persist) {
      const granted = navigator.storage.persist();
      console.log("是否允许持久储存:", granted);
    }

    this.dbReady = new Promise((resolve, reject) => {
      const request = indexedDB.open("reader", 8)
      request.onupgradeneeded = (event) => {
        this.db = event.target.result

        //metadata表
        if (!this.db.objectStoreNames.contains("metadata")) {
          const metadataStore = this.db.createObjectStore("metadata", {
            keyPath: "hashCode"
          })
          // console.log("创建metadata表")
          metadataStore.createIndex("title", "title", { unique: false })
          metadataStore.createIndex("cover", "cover", { unique: false })
          metadataStore.createIndex("author", "author", { unique: false })
          metadataStore.createIndex("abstract", "abstract", { unique: false })
          metadataStore.createIndex("process", "process", { unique: false })
          metadataStore.createIndex("putTime", "putTime", { unique: false })
        }

        //binary表
        if (!this.db.objectStoreNames.contains("binary")) {
          const binaryStore = this.db.createObjectStore("binary", {
            keyPath: "hashCode"
          })

          binaryStore.createIndex("binary", "binary", { unique: false })

        }

      }
      request.onsuccess = (event) => {
        this.db = event.target.result
        resolve()
      }
      request.onerror = (error) => {
        reject(error)
        error=error.target.error

        if (error?.name === "QuotaExceededError") {
          alert("存储空间不足或浏览器存储配额已满，请清理磁盘或浏览器数据后重试。")
        } else {
          alert("数据库打开失败：" + error?.message || error)
          // console.error("数据库打开失败：", error?.message || error)
        }
      }
    })

  }

  async putNewBook(book) {
    await this.dbReady
    const tx1 = this.db.transaction("metadata", "readwrite")//创建一条事务
    const metadataStore = tx1.objectStore("metadata")
    if (!book.options) {
      book.options = defaultReadOptions
    }
    console.log("阅读选项:", book.options)
    const putReq = metadataStore.put({
      hashCode: book.hashCode,
      title: book.title,
      author: book.author,
      cover: book.cover,
      process: book.process,
      abstract: book.abstract,
      tags: book.tags,
      putTime: book.putTime,
      options: book.options
    })
    putReq.onsuccess = () => { }
    putReq.onerror = (e) => console.error('metadata put error:', putReq.error || e)
    const tx2 = this.db.transaction("binary", "readwrite")
    const binaryStore = tx2.objectStore("binary")
    const binReq = binaryStore.put({
      hashCode: book.hashCode,
      binary: book.arrayBuffer
    })
    binReq.onsuccess = () => { }
    binReq.onerror = (e) => console.error('binary put error:', binReq.error || e)
  }

  removeBook(book) {
    const tx1 = this.db.transaction("metadata", "readwrite")//创建一条事务
    const metadataStore = tx1.objectStore("metadata")
    metadataStore.delete(book.hashCode)
    const tx2 = this.db.transaction("binary", "readwrite")
    const binaryStore = tx2.objectStore("binary")
    binaryStore.delete(book.hashCode)
  }

  async touchBook(hashCode, newTime = Date.now()) {
    await this.dbReady
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("metadata", "readwrite")
      const store = tx.objectStore("metadata")
      const getReq = store.get(hashCode)
      getReq.onsuccess = () => {
        const rec = getReq.result
        if (!rec) return resolve(false)
        const updated = Object.assign({}, rec, { putTime: newTime })
        const putReq = store.put(updated)
        putReq.onsuccess = () => resolve(true)
        putReq.onerror = () => reject(putReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    })
  }

  async saveBookOptions(hashCode, options = defaultReadOptions) {
    await this.dbReady
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("metadata", "readwrite")
      const store = tx.objectStore("metadata")
      const getReq = store.get(hashCode)
      getReq.onsuccess = () => {
        const rec = getReq.result
        if (!rec) return resolve(false)
        const updated = Object.assign({}, rec, { options, })
        const putReq = store.put(updated)
        putReq.onsuccess = () => resolve(true)
        putReq.onerror = () => reject(putReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    })
  }

  async getBookByHashCode(hashCode) {
    await this.dbReady
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("binary", "readonly");
      const store = tx.objectStore("binary");
      const request = store.get(hashCode);
      request.onsuccess = () => {
        console.log("加载成功")
        resolve(request.result);
      }
      request.onerror = () => reject(request.error);
    });
  }

  async getBookMetadataByHashCode(hashCode) {
    await this.dbReady
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("metadata", "readonly");
      const store = tx.objectStore("metadata");
      const request = store.get(hashCode);
      request.onsuccess = () => {
        console.log("加载成功")
        resolve(request.result);
      }
      request.onerror = () => reject(request.error);
    });
  }

  async getAllBooks() {
    await this.dbReady
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("metadata", "readonly");
      const store = tx.objectStore("metadata");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export class Book {
  constructor(hashCode, arrayBuffer, cover, title, author, process, putTime, abstract, tags, options) {
    this.hashCode = hashCode
    this.cover = cover
    this.arrayBuffer = arrayBuffer
    this.author = author
    this.process = process
    this.abstract = abstract
    this.tags = tags
    this.title = title
    this.putTime = putTime
    this.options = options
  }
}

