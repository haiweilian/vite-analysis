import { Plugin } from "../plugin";
import { cleanUrl } from "../utils";

// 将静态资源请求包装成 js 模块，导出一个路径字符串
export function assetPlugin(): Plugin {
  return {
    name: "vite:asset",
    load(id) {
      const cleanId = cleanUrl(id);
      if (cleanId.endsWith(".svg")) {
        return {
          // 包装成一个 js 模块
          code: `export default "${cleanId}"`,
        };
      }
    },
  };
}
