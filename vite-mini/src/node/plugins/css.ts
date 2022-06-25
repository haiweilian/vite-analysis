import { readFile } from "fs-extra";
import { CLIENT_PUBLIC_PATH } from "../constants";
import { Plugin } from "../plugin";
import { ServerContext } from "../server";
import { getShortName, isCSSRequest } from "../utils";

// 读取 css 文件，包装成 js 文件执行，将 css 插入的页面的 style 中
export function cssPlugin(): Plugin {
  let serverContext: ServerContext;

  return {
    name: "vite:css",

    configureServer(s) {
      serverContext = s;
    },

    // 读取文件内容
    load(id) {
      if (isCSSRequest(id)) {
        return readFile(id, "utf8");
      }
    },

    // 转换文件内容
    transform(code, id) {
      if (isCSSRequest(id)) {
        const jsContent = `
import { createHotContext as __vite__createHotContext } from "${CLIENT_PUBLIC_PATH}";
import.meta.hot = __vite__createHotContext("/${getShortName(
          id,
          serverContext.root
        )}");

import { updateStyle, removeStyle } from "${CLIENT_PUBLIC_PATH}"
  
const id = '${id}';
const css = '${code.replace(/\n/g, "")}';

updateStyle(id, css);
import.meta.hot.accept();
export default css;
import.meta.hot.prune(() => removeStyle(id));`.trim();

        return {
          code: jsContent,
        };
      }

      return null;
    },
  };
}
