<!-- 该组件样式由外部负责，组件内只负责展示和定位 -->
<script setup lang="js">
import {defineProps, onMounted,ref} from "vue"

const props=defineProps({
  noteRefRect:Object
})

const noteCardEl=ref(null)
onMounted(()=>{
  console.log('noteCard mounted',props.noteRefRect)
  if(!props.noteRefRect)return
  if(noteCardEl.value.clientWidth>document.documentElement.clientWidth){
    //宽度超出屏幕，复制样式
    noteCardEl.value.style.width=`${document.documentElement.clientWidth-20}px`
  }
  noteCardEl.value.style.top=`${props.noteRefRect.bottom}px`
  let left=props.noteRefRect.left-noteCardEl.value.clientWidth/2
  left=Math.max(10,left)
  if(left+noteCardEl.value.clientWidth>document.documentElement.clientWidth-10){
    left=document.documentElement.clientWidth-10-noteCardEl.value.clientWidth
  }
  noteCardEl.value.style.left=`${left}px`
})

</script>
<template>
  <div ref="noteCardEl" class="note-card">
    <slot></slot>
  </div>
</template>
<style scoped>
.note-card {
  position: fixed;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 12px;
  background-color: #f9f9f9;
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.1);
}
</style>
