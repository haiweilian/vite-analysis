import { Plugin } from "rollup";

/**
 * @type { () => Plugin }
 */
export default function load(options) {
  return {
    name: "rollup:load",
    // resolveId 主要用来解析模块路径
    resolveId(id) {
      if(id === 'module-b') {
        return 'module-b'
      }else {
        return null
      }
    },
    // 根据 resolveId 解析后的路径，加载模块内容
    load(id) {
      if(id !== 'module-b') {
        return null
      }

      // source 当前模块路径
      // console.log("id....", id);

      return {
        code: 'export const b = 2;',
        map: null
      }
    },
  };
}
