
export const ABSOULTE_DISENBALED=0;
export const AUTO_ENABLED=1;
export const ABSOLUTEENABLED=2;

export const READING_MODE_SINGLE = "single"
export const READING_MODE_DOUBLE = "double"
export const READING_MODE_SCROLL = "scroll"
export const READING_MODE_AUTO = "auto"


export const defaultReadOptions = {

  bestFitEnabled: true,
  readingMode:READING_MODE_AUTO,
  clickToFlipEnabled: false,
  backgroundColor: "antiquewhite",
  loadByHtml:true,
  iframeScrollEnabled: false,
  loadJsEnabled: true,
  pagePadding:30,
  lNovelEnabled: AUTO_ENABLED,


}


export const transitionDuration = 200//单位：ms
