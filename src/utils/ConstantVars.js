
export const ABSOULTE_DISENBALED=0;
export const AUTO_ENABLED=1;
export const ABSOLUTEENABLED=2;

export const READING_MODE_SINGLE = "single"
export const READING_MODE_DOUBLE = "double"
export const READING_MODE_SCROLL = "scroll"
export const READING_MODE_AUTO = "auto"


export const defaultReadOptions = {

  bestFitEnabled: true,
  reaedingMod:READING_MODE_AUTO,
  pageDirection: "ltr",//开本方向[default, ltr, rtl]
  clickToFlipEnabled: false,
  backgroundColor: "antiquewhite",
  loadByHtml:true,
  compatibleMode:false,
  iframeScrollEnabled: false,
  loadJsEnabled: true,
  pagePadding:30,
  fontSize:16,
  lNovelEnabled: AUTO_ENABLED,


}


export const transitionDuration = 200//单位：ms
