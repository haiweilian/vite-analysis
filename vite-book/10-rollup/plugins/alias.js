import { Plugin } from "rollup";

/**
 * @type { (options: {entries: {find: string, replacement: string}[]}) => Plugin }
 */
export default function alias(options) {
  // 获取到配置
  const entries = options.entries;

  return {
    name: "rollup:alias",
    // resolveId 主要用来解析模块路径
    resolveId(source, importer, resolveOptions) {
      // source 当前模块路径
      // console.log("source....", source);
      // importer 引用当前模块的模块路径
      // console.log("importer....", importer);
      // resolveOptions 其他配置
      // console.log("resolveOptions....", resolveOptions);

      // 先检查能不能匹配别名规则
      const matchedEntry = entries.find((entry) => entry.find === source);

      // console.log("-------matchedEntry", matchedEntry);
      if (matchedEntry) {
        return matchedEntry.replacement;
      } else {
        // 返回找到后的路径
        return null;
      }
    },
  };
}
