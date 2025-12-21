/**
@props: visible-控制是否显示;
@emit: close-关闭事件;confirm-完成事件
父组件完成相应逻辑后需手动将visible改成false以关闭对话框，否则视为仅完成，对话框无需关闭
*/
<script setup lang="ts">
import DialogManagement from "@/utils/dialogManagement.ts"
import { watch, onBeforeUnmount, onMounted, ref, nextTick, onBeforeUpdate, onBeforeMount } from "vue";

//获取实例
const dialogManagement = DialogManagement.get()
//这里ref的泛型是给.value的类型
const dialog = ref<HTMLElement | null>(null)

const emit = defineEmits(["close", "confirm"])

const props = withDefaults(defineProps<{
  title?: string,
  closeByBack?: boolean,
  visible: boolean,
}>(), {
  title: "Next",
  closeByBack: true,
  visible: false,
})

const ownVisible = ref(false);
//watch的第一个参数可以传一个getter函数。此处props是只读的，watch在ts中支持ref()和getter，不支持直接的getter
//另外，watch在setup阶段就被注册了，但首次初始化值并不会触发
watch(() => props.visible, async (newVisible, oldVisible) => {
  if (!oldVisible && newVisible) {
    //也就是打开对话框
    console.log("对话框打开")
    ownVisible.value = true//先让DOM渲染后才能加池子
    await nextTick()
    dialogManagement.openDialog(dialog.value)
  } else if (oldVisible && !newVisible) {
    //从开启状态到关闭
    console.log("对话框关闭")
    dialog.value?.classList.add("fade")
    //对话框出栈
    dialogManagement.closeDialog(dialog.value)
    ownVisible.value = false
  }
})

onBeforeMount(() => {
  if (props.visible) {
    //如果默认为展开状态
    dialogManagement.openDialog(dialog.value)
  }
})

onBeforeUnmount(() => {
  //防止意外关闭，取消挂载前操作一下
  console.error("对话框被意外关闭，管理器强制移除")
  dialogManagement.closeDialog(dialog.value)
})


function close() {
  emit("close")
}

function confirm() {
  emit("confirm")
}

</script>
<template>
  <Teleport to="#app">
    <div v-if="ownVisible" ref="dialog" name="overlay" class="overlay" @click.self="props.closeByBack ? close() : null">
      <div class="dialog" :initial="{ opacity: 0.2, scale: 0.2, y: -500 }" :animate="{ opacity: 1, scale: 1, y: 0 }"
        :exit="{ opacity: 0.2, scale: 0.2, y: -500 }" :transition="{
          type: 'spring', stiffness: 450, // 增加刚度，更快回弹,
          damping: 28, // 增加阻尼，减少弹跳次数
          duration: 0.3 // 直接控制总时长
        }">
        <slot name="header">
          <h4>{{ title }} <button @click="close">×</button></h4>
        </slot>
        <slot name="body">
          神人此处不写插槽
        </slot>
        <slot name="foot">
          <div class="foot">
            <button @click="close">取消</button>
            <button @click="confirm">确定</button>
          </div>
        </slot>
      </div>
    </div>
  </Teleport>
</template>
<style lang="less" scoped>
.fade {
  opacity: 0;

  .dialog {
    transform: scale(0.2) translateY(-200px) !important;
    transition: all 0.25s ease-out;
  }
}

.overlay {
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  width: calc(100vw);
  height: calc(100vh);
  backdrop-filter: blur(1px);
  background-color: rgba(0, 0, 0, 0.4);
  animation: dialogEnter 0.4s ease;
  transition: opacity 0.25s ease,
    transform 0.25s ease,
    background-color 0.25s ease;

  .dialog {
    background-color: aliceblue;
    border-radius: 8px;
    max-width: calc(90vw);
    max-height: calc(90vh);
    // height: 200px;
    transform: none;
    // overflow: hidden;

    h4 {
      display: flex;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #9fa8ba;
      color: rgb(39, 39, 39);
      font-size: 24px;
      font-weight: 700;

      button {
        color: gray;
        font-size: 24px;
        text-align: right;
        background: none;
        border: none;
        outline: none;
        transition: all 0.2s ease;

        &:hover {
          color: black
        }
      }
    }

    .foot {
      padding: 12px;
      border-top: 1px solid #9fa8ba;
      text-align: right;

      button {
        box-sizing: border-box;
        height: 42px;
        padding: 12px 16px;
        border: 1px solid rgba(0, 0, 0, 0);
        border-radius: 21px;
        line-height: 20px;
        box-shadow: 0px 0px 1px 0.5px #c9d9ee;
        transition: all 0.2s ease;

        &:nth-child(1) {
          color: rgb(107, 107, 107);
          background-color: #efe8e8aa;
          margin-right: 16px;

          &:hover {
            color: #2583FE;
            border: 1px solid #2583FE;
          }
        }

        &:nth-child(2) {
          font-weight: 600;
          color: rgb(240, 240, 240);
          background-color: #2583FE;

          &:hover {
            background-color: #66a0ec;
          }

          &:active {
            background-color: #104b98;
          }
        }
      }
    }
  }
}
</style>
