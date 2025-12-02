<script setup lang="js">
import {defineProos} from "vue"
const props=defineProos()

</script>
<template>
  <div class="note-card">
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
