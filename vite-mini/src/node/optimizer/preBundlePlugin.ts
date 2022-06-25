import { Loader, Plugin } from "esbuild";
import { BARE_IMPORT_RE } from "../constants";
// 用来分析 es 模块 import/export 语句的库
import { init, parse } from "es-module-lexer";
import path from "path";
// 一个实现了 node 路径解析算法的库
import resolve from "resolve";
// 一个更加好用的文件操作库
import fs from "fs-extra";
// 用来开发打印 debug 日志的库
import createDebug from "debug";

const debug = createDebug("dev");

export function preBundlePlugin(deps: Set<string>): Plugin {
  return {
    name: "esbuild:pre-bundle",
    setup(build) {
      build.onResolve(
        {
          filter: BARE_IMPORT_RE,
        },
        (resolveInfo) => {
          const { path: id, importer } = resolveInfo;
          const isEntry = !importer;
          // console.log("...", id, isEntry);

          // 命中缓存需要编译
          if (deps.has(id)) {
            return isEntry
              ? {
                  path: id,
                  namespace: "dep",
                }
              : {
                  // 解析模块的绝对路径
                  path: resolve.sync(id, { basedir: process.cwd() }),
                };
          }
        }
      );

      // 加载命名空间为 dep 的模块，构建代理模块。
      // 所谓代理模块是创建一个虚拟的模块文件，在虚拟模块中导入原始的模块。
      build.onLoad(
        {
          filter: /.*/,
          namespace: "dep",
        },
        async (loadInfo) => {
          await init;
          const id = loadInfo.path;
          const root = process.cwd();
          const entryPath = resolve.sync(id, { basedir: root });

          // 读取模块代码，解析出所有的 import 和 export
          const code = await fs.readFile(entryPath, "utf-8");
          const [imports, exports] = await parse(code);
          // console.log(imports, exports);

          // 代理模块
          let proxyModule = [];

          // 没有导入导出为 cjs 模块
          if (!imports.length && !exports.length) {
            // 获取对象的所有导出的方法
            const res = require(entryPath);
            const specifiers = Object.keys(res);
            // console.log(res, specifiers);

            // 将方法以 es 的方式导出：import { useState } from 'react'
            proxyModule.push(
              `export { ${specifiers.join(",")} } from "${entryPath}"`,
              `export default require("${entryPath}")`
            );
          } else {
            // 如果包含 包含默认导出，也增加默认导出
            if (exports.includes("default")) {
              proxyModule.push(`import d from "${entryPath}";export default d`);
            }

            // 再导入所有的非默认导出
            proxyModule.push(`export * from "${entryPath}"`);
          }

          debug("代理模块内容: %o", proxyModule.join("\n"));

          // 根据后缀名获取加载器
          const loader = path.extname(entryPath).slice(1);
          return {
            loader: loader as Loader,
            contents: proxyModule.join("\n"),
            resolveDir: root,
          };
        }
      );
    },
  };
}
