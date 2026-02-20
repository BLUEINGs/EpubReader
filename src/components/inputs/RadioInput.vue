<script setup lang="js">
const props = defineProps({
  options: {
    type: Object,
    required: true
  },
  //options应当是一个js对象：
  /*
  options:{
    option1:value1,
    option2:value2,
    ...
  }
   */
})
const selected = defineModel({
  type: null,
  default: null,
  required: true
})
</script>
<template>
  <div class="radio-input">
    <button :class="{ selected: selected === value }" @click="selected = value" v-for="(value, key) in options"
      :key="key">{{ key }}</button>
  </div>
</template>
<style lang="less" scoped>
.radio-input {
  display:inline-block;
  border-radius: 24px;
  border:4px solid white;
  box-shadow: 1px 1px 0 0.5px rgba(0, 0, 0, 0.6);
  background-color: rgb(200, 200, 200);
  overflow: hidden;

  button {
    border: none;
    outline: none;
    font-size: 14px;
    font-weight: bold;
    padding: 8px;
    color: rgb(0, 0, 0);
    background-color: rgb(200, 200, 200);

    &.selected {
      border-radius:24px;
      color: white;
      background-color: brown;
    }

    &:active {
      color: brown;
    }
  }
}

@media screen and (max-width:768px) {
.radio-input {
  display:inline-block;
  border-radius: 20px;
  border:2px solid white;
  box-shadow: 1px 1px 0 0.5px rgba(0, 0, 0, 0.6);
  background-color: rgb(200, 200, 200);
  overflow: hidden;

  button {
    font-size: 12px;
    padding: 4px;

    &.selected {
      border-radius:20px;
    }
  }
}
}
</style>
