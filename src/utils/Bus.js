import { reactive } from 'vue'
import { defaultReadOptions } from './ConstantVars.js'

const bus = reactive({curReadOptions:defaultReadOptions})  // 或者简单用空对象
/*
reactive()跟ref()区别：
1. reactive()适用于对象和数组，ref()适用于基本数据类型（如字符串、数字、布尔值等）和对象活或数组。
2. reactive()会返回一个响应式对象，而ref()会返回一个包含value属性的响应式引用。
3. 对于第二点，直白的说，reactive()的对象不用.value就可以直接访问和修改属性，而ref()需要通过.value来访问和修改值。
*/

export default bus
