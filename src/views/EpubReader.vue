<script setup lang="js">
import ePub from 'epubjs';
import { onMounted } from 'vue';

onMounted(() => {
  const book = ePub("@/test.epub");
const rendition = book.renderTo("viewer", {
  width: "100%",
  height: "100%",
});
rendition.display();
});



</script>
<template>
  <div id="viewer"></div>
</template>
<style>
#viewer {
  width: 800px;
  height: 600px;
  background-color: #fff;
}

</style>
