export class BookShelf {
  constructor() {
    this.dbReady = new Promise((resolve, reject) => {
      const request = indexedDB.open("reader", 1)
      request.onupgradeneeded = (event) => {
        this.db = event.target.result

        //metadata表
        if (!this.db.objectStoreNames.contains("metadata")) {
          const metadataStore = this.db.createObjectStore("metadata", {
            keyPath: "hashCode"
          })

          metadataStore.createIndex("title", "title", { unique: false })
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
      avator: book.avator,
      process: book.process
    })
    const tx2 = this.db.transaction("binary", "readwrite")
    const binaryStore = tx2.objectStore("binary")
    binaryStore.put({
      hashCode: book.hashCode,
      binary: book.binary
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

  async getBookByHashCode(hashCode) {
    await this.dbReady
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("binary", "readonly");
      const store = tx.objectStore("binary");
      const request = store.get(hashCode);
      request.onsuccess = () => resolve(request.result);
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
  constructor(hashCode, arrayBuffer, title, avator, process) {
    this.hashCode = hashCode
    this.arrayBuffer = arrayBuffer
    this.avator = avator
    this.process = process
    this.title = title
  }
}

