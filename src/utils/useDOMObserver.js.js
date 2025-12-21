// useResizeObserver.js
import { onMounted, onBeforeUnmount } from 'vue'

export function useResizeObserver(elRef, callback) {
  let observer = null

  onMounted(() => {
    observer = new ResizeObserver(entries => {
      callback(entries[0].contentRect)
    })
    observer.observe(elRef.value)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
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
