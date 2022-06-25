import resolve from "resolve";
import { Plugin } from "../plugin";
import { ServerContext } from "../server/index";
import path from "path";
import { pathExistsSync } from "fs-extra";
import { DEFAULT_EXTERSIONS } from "../constants";
import { cleanUrl } from "../utils";

// 路径解析
export function resolvePlugin(): Plugin {
  let serve: ServerContext;
  return {
    name: "vite:resolve",
    configureServer(s) {
      serve = s;
    },

    async resolveId(id, importer?: string) {
      // 如果是绝对路径
      if (path.isAbsolute(id)) {
        try {
          if (pathExistsSync(id)) {
            return {
              id,
            };
          }
          // 加载 root 的前缀再查找
          id = path.join(serve.root, id);
          if (pathExistsSync(id)) {
            return {
              id,
            };
          }
        } catch (error) {}
      }
      // 如果是相对路径
      else if (id.startsWith(".")) {
        if (!importer) {
          throw new Error("`importer` should not be undefined");
        }

        const hasExtension = path.extname(id).length > 1;
        let resolvedId: string;

        // 如果包含扩展名，从父级目录计算路径
        if (hasExtension) {
          resolvedId = resolve.sync(id, { basedir: path.dirname(importer) });

          if (pathExistsSync(resolvedId)) {
            return {
              id: resolvedId,
            };
          }
        }

        // 不包含扩展名，补充扩展名查找
        for (const extname of DEFAULT_EXTERSIONS) {
          try {
            const withExtension = `${id}${extname}`;
            resolvedId = resolve.sync(withExtension, {
              basedir: path.dirname(importer),
            });
            if (pathExistsSync(resolvedId)) {
              return { id: resolvedId };
            }
          } catch (e) {
            continue;
          }
        }
      }
      return null;
    },
  };
}
