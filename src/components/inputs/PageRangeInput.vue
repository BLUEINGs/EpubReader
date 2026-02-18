<script setup lang="js">
import RangeInput from './RangeInput.vue';
import PageSelector from './PageSelector.vue';

const props = defineProps({
  max: {
    type: [Number, String],
    required: true
  },
  min: {
    type: [Number, String],
    default: 0
  },
  name: {
    type: String,
    required: true
  }
})
const value = defineModel("value", {
  type: [Number, String],
  default: 0,
  required: true
})
/* 关于watchAPI的执行顺序：
旧值
  ↓
响应式值发生变化（新值已写入）
  ↓
watch 回调执行（拿到 newVal / oldVal）
*/
/* watch(value,()=>{

}) */
</script>
<template>
  <!-- :属性=""，这个写法里面写得其实是“js表达式”，里面必须是一个合法js表达式，换句话说里面写的一定是代码，比如下面这行，加``变成模板字符串就算是合法表达式 -->
  <div class="slider-input">
    <button class="pre" @click="value--"><</button>
    <PageSelector v-model:selectedPage="value" :totalPages="props.max"></PageSelector>
    <RangeInput v-model:value="value" :max="props.max" :min="props.min" :name="props.name"></RangeInput>
    <button class="next" @click="value++">></button>

  </div>
</template>
<style lang="less" scoped>
.slider-input {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  height: 32px;
  border-radius: 24px;
  background-color: rgba(0, 0, 0, 0.2);
  button{
    border:none;
    outline:none;
    margin:0 10px;
    font-size: 24px;
    font-weight: bold;
    color: rgb(53, 53, 53);
    background: transparent;
    cursor: pointer;
    &.setting{
      width: 32px;
      height: 32px;
      color:rgb(53, 53, 53);
      background: url('@/assets/icons/setting.svg') no-repeat center;
      background-size: contain;
    }
  }

  span {
    font-size: 14px;
    font-weight: bold;
    color: rgb(53, 53, 53);
    margin-right: 10px;
  }
}
</style>
