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

export function useScrollObserver(elRef, callback) {

  onMounted(() => {
    elRef.value.addEventListener('scroll', () => {
      callback({
        scrollTop: elRef.value.scrollTop,
        scrollLeft: elRef.value.scrollLeft,
        scrollWidth: elRef.value.scrollWidth,
        scrollHeight: elRef.value.scrollHeight,
        })
    })
  })

  onBeforeUnmount(() => {
    elRef.value.removeEventListener('scroll', () => {
      callback(elRef.value.scrollTop, elRef.value.scrollLeft)
    })
  })

}
