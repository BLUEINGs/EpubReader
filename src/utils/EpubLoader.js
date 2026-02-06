
async function loadSpineAndInfos(zip) {
  const containerXml = await zip.file("META-INF/container.xml").async("string");
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, "application/xml");
  const rootfilePath = containerDoc.querySelector("rootfile").getAttribute("full-path");
  // console.log("rootfile路径：", rootfilePath);
  // 例如 "OEBPS/content.opf"
  const opfXml = await zip.file(rootfilePath).async("string");
  const opfDoc = parser.parseFromString(opfXml, "text/html");

  // 获取 spine
  const spine = [...opfDoc.querySelectorAll("spine itemref")].map(itemref => itemref.getAttribute("idref"));

  // 获取 manifest 对应 href
  const manifest = {};
  opfDoc.querySelectorAll("manifest item").forEach(item => {
    manifest[item.getAttribute("id")] = item.getAttribute("href");
  });

  // spine 对应的实际文件列表
  const spineFiles = spine.map(idref => manifest[idref]);
  console.log(spineFiles); // ["Text/chapter1.xhtml", "Text/chapter2.xhtml"]。解析成功

  //获取封面
  const rootDir = rootfilePath.substring(0, rootfilePath.lastIndexOf("/"));
  // const promises = []
  const coverReference = opfDoc.querySelector("reference[type='cover']")
  let coverPath = "";
  if (coverReference) {
    coverPath = rootDir + (rootDir ? "/" : "") + coverReference.getAttribute("href");
  } else {
    coverPath = rootDir + (rootDir ? "/" : "") + spineFiles[0];
  }
  console.log("封面章节路径：", coverPath);
  const coverFile = zip.file(coverPath)//这里拿到cover.html或者cover.xhtml
  let coverHtml = await coverFile.async("string")
  coverHtml = coverHtml.replace(/^\uFEFF/gi, "")
    .replace(/&#65279;/gi, "")
    .replace(/&#xFEFF;/gi, "");; //去掉BOM头

  const doc = parser.parseFromString(coverHtml, "text/html");
  const imgElem = doc.querySelectorAll("img,image")[0]

  let coverBase64 = "";
  let imgSrc = imgElem.getAttribute("src") || imgElem.getAttribute("xlink:href");
  if (!imgSrc) return;
  //转换为绝对路径
  imgSrc = relativePathToAbsolutePath(coverPath, imgSrc)
  console.log("封面图片路径：", imgSrc);
  const imgFile = zip.file(imgSrc);
  if (!imgFile) {
    console.warn("封面图片资源未找到：", imgSrc);
    return;
  }
  await imgFile.async("base64").then(base64Data => {
    // console.log("封面图片Base64数据加载完成", base64Data.length);
    const mimeType = imgFile._data.compressedSize ? imgFile._data.uncompressedContentType : "image/png"; //简单判断mimeType
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    coverBase64 = dataUrl;
  });
  // console.log("封面图片加载完成,数据量：", coverBase64.length);

  //获取书籍信息
  const infos = {
    title: opfDoc.querySelector("metadata dc\\:title")?.textContent,
    author: opfDoc.querySelector("metadata dc\\:creator")?.textContent,
    abstract: opfDoc.querySelector("metadata dc\\:description")?.textContent,
    tags: [...opfDoc.querySelectorAll("metadata dc\\:subject")].map(elem => elem.textContent),
    cover: coverBase64,
  };

  // console.log("看看标题元素",opfDoc.querySelector("metadata dc\\:title"))

  return [spineFiles, infos, rootfilePath];
}

async function loadSpine(zip) {
  const containerXml = await zip.file("META-INF/container.xml").async("string");
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, "application/xml");
  const rootfilePath = containerDoc.querySelector("rootfile").getAttribute("full-path");
  // console.log("rootfile路径：", rootfilePath);
  // 例如 "OEBPS/content.opf"
  const opfXml = await zip.file(rootfilePath).async("string");
  const opfDoc = parser.parseFromString(opfXml, "application/xml");

  // 获取 spine
  const spine = [...opfDoc.querySelectorAll("spine itemref")].map(itemref => itemref.getAttribute("idref"));

  // 获取 manifest 对应 href
  const manifest = {};
  opfDoc.querySelectorAll("manifest item").forEach(item => {
    manifest[item.getAttribute("id")] = item.getAttribute("href");
  });

  // spine 对应的实际文件列表
  const spineFiles = spine.map(idref => manifest[idref]);
  console.log(spineFiles); // ["Text/chapter1.xhtml", "Text/chapter2.xhtml"]。解析成功

  return [spineFiles, rootfilePath];
}

function relativePathToAbsolutePath(curFilePath, src) {
  // console.log("原始资源路径：", src);
  //src是章节文件中引用的资源路径，如"../Images/pic1.jpg"
  //需要把它转换成zip中的路径，如"OEBPS/Images/pic1.jpg"
  const curDir = curFilePath.substring(0, curFilePath.lastIndexOf('/')).split('/');
  if (curDir.length == 1 && curDir[0] === "") {
    curDir.pop();//根目录特殊处理
  }
  // console.log("当前章节文件目录：", curDir);
  //获取当前章节文件所在目录，如["OEBPS","Text"]
  src = src.replace("../", () => {
    //这地方可能有异常，找到顶层路径了还继续../，记得后面加上异常抛出
    curDir.pop();
    return "";
  }).replace("./", "");
  return curDir.join('/') + (curDir.length != 0 ? '/' : '') + src
}

export { loadSpine, loadSpineAndInfos, relativePathToAbsolutePath };
