export default class DialogManagement {
  /*
  思路：一个全局对话框管理器，维护一个对话框队列
  1.当有对话框打开时，先记录队尾的index，然后把新对话框push进这个队列，给到这个对话框index+1
  2.正常情况下，对话框应该是从最上层开始关闭的。在此情况下，直接关闭即可。
  但也存在一种情况，队列倒数第二个或者倒数第三个对话框关闭，这时应该关闭从那个对话框开始到最后的所有对话框。
  所以这个队列应该储存的应该是HTMLElement，当关闭时来对照是谁关闭了。应该让每个HTMLElement实例在销毁时来调用关闭方法
  */

  public static instance: DialogManagement

  private initIndex: number = 1000
  private indexs: Array<HTMLElement> = []

  private constructor() {
    DialogManagement.instance = this
  }

  public static get() {
    if (DialogManagement.instance) {
      return DialogManagement.instance
    }
    return new DialogManagement()
  }

  public openDialog(dialog: HTMLElement | null) {
    console.log('dialog即将被添加')
    if (dialog == null) {
      console.log('dialog为null')
      return
    }
    if (this.indexs.includes(dialog)) {
      console.log('dialog已经被添加')
    }
    dialog.style.zIndex = (this.initIndex + this.indexs.length).toString()
    this.indexs.push(dialog)
    console.log('dialog添加成功')
  }

  public closeDialog(dialog: HTMLElement | null) {
    if (dialog == null) {
      return
    }
    if (!this.indexs.includes(dialog)) {
      //不要抛出异常，抛出了我也不会处理，这里就是防止不正常调用
      return
    }
    let found: HTMLElement | null | undefined = null
    while (dialog != found) {
      found = this.indexs.pop()
    }
  }
}
