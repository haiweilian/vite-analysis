// 新建 src/node/plugins/importAnalysis.ts
import { init, parse } from "es-module-lexer";
import {
  BARE_IMPORT_RE,
  CLIENT_PUBLIC_PATH,
  DEFAULT_EXTERSIONS,
  PRE_BUNDLE_DIR,
} from "../constants";
import { cleanUrl, isJSRequest, getShortName } from "../utils";
// magic-string 用来作字符串编辑
import MagicString from "magic-string";
import path from "path";
import { Plugin } from "../plugin";
import { ServerContext } from "../server/index";
import { pathExists } from "fs-extra";
import resolve from "resolve";

// 导入分析，解析当前文件导入的模块，处理文件内容中的路径： bare import 和 相对路径
export function importAnalysisPlugin(): Plugin {
  let serverContext: ServerContext;
  return {
    name: "m-vite:import-analysis",
    configureServer(s) {
      // 保存服务端上下文
      serverContext = s;
    },
    async transform(code: string, id: string) {
      // 只处理 JS 相关的请求
      if (!isJSRequest(id)) {
        return null;
      }
      await init;
      // 解析 import 语句
      const [imports] = parse(code);
      const ms = new MagicString(code);

      const resolve = async (id: string, importer?: string) => {
        // @ts-ignore
        const resolved = await this.resolve(id, importer);
        if (!resolved) {
          return;
        }
        const cleanedId = cleanUrl(resolved.id);
        const mod = moduleGraph.getModuleById(cleanedId);
        let resolvedId = `/${getShortName(resolved.id, serverContext.root)}`;
        if (mod && mod.lastHMRTimestamp > 0) {
          resolvedId += "?t=" + mod.lastHMRTimestamp;
        }
        return resolvedId;
      };

      // 获取到之前在 load 之后，transform 之前创建的模块
      const { moduleGraph } = serverContext;
      const curMod = moduleGraph.getModuleById(id)!;
      const importedModules = new Set<string>();

      // 对每一个 import 语句依次进行分析
      for (const importInfo of imports) {
        // 举例说明: const str = `import React from 'react'`
        // str.slice(s, e) => 'react'
        const { s: modStart, e: modEnd, n: modSource } = importInfo;
        if (!modSource) continue;

        // 静态资源
        if (modSource.endsWith(".svg")) {
          // 加上 ?import 后缀
          const resolvedUrl = path.join(path.dirname(id), modSource);
          ms.overwrite(modStart, modEnd, `${resolvedUrl}?import`);
          continue;
        }

        // 第三方库: 路径重写到预构建产物的路径
        if (BARE_IMPORT_RE.test(modSource)) {
          const bundlePath = path.join(
            serverContext.root,
            PRE_BUNDLE_DIR,
            `${modSource}.js`
          );
          ms.overwrite(modStart, modEnd, bundlePath);
          // 添加依赖模块集合里
          importedModules.add(bundlePath);
        } else if (modSource.startsWith(".") || modSource.startsWith("/")) {
          const resolved = await resolve(modSource, id);
          if (resolved) {
            ms.overwrite(modStart, modEnd, resolved);
            importedModules.add(resolved);
          }
        }
      }

      // 只对业务源码注入
      if (!id.includes("node_modules") && !id.includes(CLIENT_PUBLIC_PATH)) {
        // 注入 HMR 相关的工具函数
        ms.prepend(
          `import { createHotContext as __vite__createHotContext } from "${CLIENT_PUBLIC_PATH}";\n` +
            `import.meta.hot = __vite__createHotContext(${JSON.stringify(
              cleanUrl(curMod.url)
            )});\n`
        );
      }

      // 更新当前的模块的信息
      moduleGraph.updateModuleInfo(curMod, importedModules);

      return {
        code: ms.toString(),
        // 生成 SourceMap
        map: ms.generateMap(),
      };
    },
  };
}
