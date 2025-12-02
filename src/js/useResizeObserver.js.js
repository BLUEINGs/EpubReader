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
