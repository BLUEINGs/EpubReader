<script setup lang="js">
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
  },
  direcation: {
    type: String,
    default: "ltr"
  }
})
const curPage = defineModel("value", {
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

function background(){
  if(props.direcation == "rtl"){
    return `background: linear-gradient(to left, brown ${curPage.value / props.max * 100}%, white ${curPage.value / props.max * 100}%)`
  }else{
    return `background: linear-gradient(to right, brown ${curPage.value / props.max * 100}%, white ${curPage.value / props.max * 100}%)`
  }
}
</script>
<template>
  <!-- :属性=""，这个写法里面写得其实是“js表达式”，里面必须是一个合法js表达式，换句话说里面写的一定是代码，比如下面这行，加``变成模板字符串就算是合法表达式 -->
  <input type="range"
    :style="background()"
    :name="props.name" :min="props.min" :max="props.max" v-model="curPage">
</template>
<style lang="less" scoped>
input {
  flex:1;
  appearance: none;
  -webkit-appearance: none;
  //appearance:auto属性值：浏览器会给滑条渲染一个黑箱控件，这个控件完全由浏览器绘制，不可手控。
  //appearance:none属性值：浏览器会放弃默认的黑箱控件，允许开发者使用CSS完全自定义滑条的外观。
  height: 8px;
  // color:white;
  border-radius: 4px;
  background: white;
  cursor: pointer;

  //关于linear-gradient(方向，颜色1，锚点1，颜色2，锚点2，...):
  // 1. 方向：可以是to right（从左到右）、to left（从右到左）、to top（从下到上）、to bottom（从上到下）等。
  // 2. 颜色和锚点：颜色可以是任何有效的CSS颜色值，
  // ！锚点是一个百分比值，他表示在这个方向上百分之多少的位置处是某个颜色（word里面的锚点）
  // 以上应用中，80%处是蓝色，80%处是半透明白色，这样从80%到80%之间会有渐变，但这个渐变区间宽度为0，所以是突变😋
  &::-webkit-slider-thumb {
    //滑条的小球是浏览器给的伪元素，这个元素DOM上一般看不见。
    // 这种伪元素是浏览器主动暴露出来的，允许开发者通过CSS进行样式定制。
    //chrome和safari浏览器使用::-webkit-slider-thumb来定制滑条的小球样式
    appearance: none;
    -webkit-appearance: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: brown;
    border: 4px solid white;
  }

  &::-moz-range-thumb {
    // ，而firefox浏览器使用::-moz-range-thumb来定制滑条的小球样式。
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #32aaff;
    background: brown;
    border: 4px solid white;
  }
}
</style>
