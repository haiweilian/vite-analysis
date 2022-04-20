import { Plugin } from "rollup";

/**
 * @type { () => Plugin }
 */
export default function replace(options) {
  return {
    name: "rollup:replace",
    // 主要用来处理模块路径
    transform(code, id) {
      // console.log('code...', code)

      let newCode = code

      // 替换字符串
      Object.keys(options).forEach(key => {
        newCode = newCode.replace(key, options[key])
      })

      return {
        code: newCode,
        map: null
      }
    },
    // 这个时候就是打包后的内容了。
    renderChunk(code, chunk) {
      // code chunk 代码
      // chunk chunk 源信息
      // console.log('renderChunkCode...', code)
      // console.log('renderChunkChunk...', chunk)
    }
  };
}
