<!--
 1.变量：该组件是一个输入组件，v-model当前页码，同时需要传递总页数作为props。
 -->
<script setup lang="js">
import { ref, watch, computed, onMounted,nextTick } from 'vue';
const emit=defineEmits(['update:selectedPage']);

const props = defineProps({
  totalPages: {
    type: Number,
    required: true
  },
  selectedPage:{
    type:Number,
    required:true
  }
});

const isEidting = ref(false);

function handleEdit() {
  isEidting.value = !isEidting.value;
}

const pageInput = ref(null);

watch(isEidting, (newVal) => {
  if (newVal) {
    nextTick(() => {
      //等一次视图更新，不然获取不到input元素
      pageInput.value.focus();
    });
  }
});

function handleEnter(){
  emit('update:selectedPage', pageInput.value.value)
  isEidting.value = false;
}

</script>
<template>
  <div @click="handleEdit" v-if="!isEidting">
    {{ selectedPage }} / {{ props.totalPages }}
  </div>
  <input v-else ref="pageInput" type="number" :value="selectedPage" :min="1" :max="props.totalPages"
    @blur="isEidting = false" @keydown.enter="handleEnter" />
</template>
<style lang="less" scoped></style>
