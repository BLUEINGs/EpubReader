<!--
 1.变量：该组件是一个输入组件，v-model当前页码，同时需要传递总页数作为props。
 -->
<script setup lang="js">
import { ref, watch, nextTick } from 'vue';
const emit = defineEmits(['update:selectedPage']);

const props = defineProps({
  totalPages: {
    type: [Number, String],
    required: true
  },
  selectedPage: {
    type: [Number, String],
    required: true
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

function handleEnter() {
  emit('update:selectedPage', pageInput.value.value)
  isEidting.value = false;
}

</script>
<template>
  <div @click="handleEdit" v-if="!isEidting">
    {{ selectedPage }} / {{ props.totalPages }}
  </div>
  <input v-else ref="pageInput" name="pageInput" type="number" :value="selectedPage" :min="1" :max="props.totalPages"
    @blur="isEidting = false" @keydown.enter="handleEnter" />
</template>
<style lang="less" scoped>
div,
input {
  box-sizing: border-box;
  width:82px;
  padding:2px 8px;
  margin:8px;
  outline: none;
  background: transparent;
  font-size: 14px;
  font-weight: 700;
  color: rgb(53, 53, 53);
  cursor: pointer;
}

input {
  border-radius: 4px;
  border: 2px solid rgba(0, 0, 0, 0.6);
  background-color: rgba(255, 255, 255, 0.4);

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    appearance: none;
    -webkit-appearance: none;
    margin: 0;
  }
}
</style>
