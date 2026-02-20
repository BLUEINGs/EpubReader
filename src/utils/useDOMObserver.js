// useResizeObserver.js
import { onMounted, onBeforeUnmount } from 'vue'

export function useResizeObserver(elRef, callback, delay = 300) {
  let observer = null
  let timer = null

  onMounted(() => {
    observer = new ResizeObserver(entries => {
      if (timer) clearTimeout(timer)

      timer = setTimeout(() => {
        callback(entries[0].contentRect)
      }, delay)
    })

    if (elRef.value) {
      observer.observe(elRef.value)
    }
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    if (timer) clearTimeout(timer)
  })
}

export function useScrollObserver(elRef, callback, { isScrolling,passive }) {
  /*
  今天再澄清一个事：
  callback是函数引用，是把这个函数当变量值传递过去
  callback()是调用函数，执行时立即调用
  */

  let scrollTimer = null

  function onScroll() {
    isScrolling.value = true

    clearTimeout(scrollTimer)
    //setTimeout函数会返回一个计时器，clearTimeout会清除这个计时器
    //此处相当于当监听一次滚动就续时一次，知道不再滚动
    scrollTimer = setTimeout(() => {
      isScrolling.value = false
    }, 120)
    callback({
      scrollTop: elRef.value.scrollTop,
      scrollLeft: elRef.value.scrollLeft,
      scrollWidth: elRef.value.scrollWidth,
      scrollHeight: elRef.value.scrollHeight,
    })
  }

  onMounted(() => {
    elRef.value.addEventListener('scroll', onScroll, { passive, })
  })

  onBeforeUnmount(() => {
    elRef.value.removeEventListener('scroll', onScroll)
    //移除时注意不要加参数
  })

  /* passive:true被动监听：
   此参数为true时表示该函数不会调用preventDefault。
   不加此参数浏览器就必须等待你监听的回调函数走完再触发默认行为，
   因为它不知道你会不会阻止默认行为，但如果开发者明确表示不会调用preventDefault
   ，浏览器就就会再完成默认行为的同时执行回调函数 */
}

export function useHashChangeObserver(callback) {
  onMounted(() => {
    window.addEventListener('hashchange', () => {
      callback(window.location.hash)
    })
  })

  onBeforeUnmount(() => {
    window.removeEventListener('hashchange', () => {
      callback(window.location.hash)
    })
  })
  window.onhashchange = callback(window.location.hash)
}
