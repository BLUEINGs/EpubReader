declare module "*.vue" {
  import { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
//该文件是给 TypeScript 识别 .vue 文件的类型声明文件用的。
//ts：你说这是DefineComponent对象，我信了，我不报错，也不管你里面写的是什么
/*
Vue机制：.ts根本不会被typescript编译器编译，它只vue中的一种文件类型，
最终vite打包时候会把.ts里面的东西处理可以直接浏览的.js，
所以.ts到底能不能正确执行无所谓，但是为了不让typescript报错，我们需要给它声明类型。
*/
