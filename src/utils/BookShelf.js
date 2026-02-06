export class BookShelf {

  static instance
  constructor() {
    if (!BookShelf.instance) {
      BookShelf.instance = this
    } else {
      return BookShelf.instance
    }
    this.dbReady = new Promise((resolve, reject) => {
      const request = indexedDB.open("reader", 4)
      request.onupgradeneeded = (event) => {
        this.db = event.target.result

        //metadata表
        if (!this.db.objectStoreNames.contains("metadata")) {
          const metadataStore = this.db.createObjectStore("metadata", {
            keyPath: "hashCode"
          })

          metadataStore.createIndex("title", "title", { unique: false })
          metadataStore.createIndex("cover", "cover", { unique: false })
          metadataStore.createIndex("author", "author", { unique: false })
          metadataStore.createIndex("abstract", "abstract", { unique: false })
          metadataStore.createIndex("process", "process", { unique: false })
          metadataStore.createIndex("putTime", "putTime", { unique: true })
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
      }
    })

  }

  putNewBook(book) {
    const tx1 = this.db.transaction("metadata", "readwrite")//创建一条事务
    const metadataStore = tx1.objectStore("metadata")
    metadataStore.put({
      hashCode: book.hashCode,
      title: book.title,
      author: book.author,
      cover: book.cover,
      process: book.process,
      abstract: book.abstract,
      tags: book.tags,
      putTime: book.putTime
    })
    const tx2 = this.db.transaction("binary", "readwrite")
    const binaryStore = tx2.objectStore("binary")
    binaryStore.put({
      hashCode: book.hashCode,
      binary: book.arrayBuffer
    })
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
  constructor(hashCode, arrayBuffer,cover, title, author, process,putTime,abstract,tags) {
    this.hashCode = hashCode
    this.cover=cover
    this.arrayBuffer = arrayBuffer
    this.author = author
    this.process = process
    this.abstract = abstract
    this.tags = tags
    this.title = title
    this.putTime = putTime
  }
}

