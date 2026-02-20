<script setup lang="js">
const value = defineModel({
  type: Boolean,
  default: false,
  required: true
})
</script>
<template>
  <div class="io-input">
    <button :class="{ selected: !value }" @click="value = false">
      OFF
    </button>
    <button :class="{ selected: value }" @click="value = true">
      ON
    </button>
  </div>
</template>
<style lang="less" scoped>
.io-input {
  display: inline-block;
  border-radius: 24px;
  // border: 4px solid white;
  box-shadow: 1px 1px 0 0.5px rgba(0, 0, 0, 0.6);
  background-color: rgb(200, 200, 200);
  overflow: hidden;

  button {
    border: none;
    outline: none;
    font-size: 14px;
    font-weight: bold;
    padding: 4px 8px;
    color: rgb(0, 0, 0);
    background-color: rgb(200, 200, 200);

    &.selected {
      border: 4px solid white;
      // box-shadow: 1px 1px 0 0.5px rgba(0, 0, 0, 0.6);
      border-radius: 24px;
      color: white;
      background-color: brown;
    }

    &:active {
      color: white;
    }
  }
}

@media screen and (max-width:768px) {
  .io-input {
    display: inline-block;
    border-radius: 18px;
    // border: 4px solid white;
    box-shadow: 1px 1px 0 0.5px rgba(0, 0, 0, 0.6);
    background-color: rgb(200, 200, 200);
    overflow: hidden;

    button {
      border: none;
      outline: none;
      font-size: 12px;
      font-weight: bold;
      padding: 2px 4px;
      color: rgb(0, 0, 0);
      background-color: rgb(200, 200, 200);
    }
  }
}
</style>
