import { NextHandleFunction } from "connect";
import {
  isJSRequest,
  cleanUrl,
  isCSSRequest,
  isImportRequest,
} from "../../utils";
import { ServerContext } from "../index";
import createDebug from "debug";

const debug = createDebug("dev");

export async function transformRequest(
  url: string,
  serverContext: ServerContext
) {
  const { pluginContainer } = serverContext;
  url = cleanUrl(url);

  // 读取缓存，缓存存在直接返回。
  const { moduleGraph } = serverContext;
  let mod = await moduleGraph.getModuleByUrl(url);
  if (mod && mod.transformResult) {
    return mod.transformResult;
  }

  // 依次调用插件容器的 resolveId、load、transform 方法
  // 调用 resolveId 钩子解析出路径
  const resolvedResult = await pluginContainer.resolveId(url);

  let transformResult;
  if (resolvedResult?.id) {
    // 调用 load 钩子加载文件内容
    let code = await pluginContainer.load(resolvedResult.id);
    if (typeof code === "object") {
      code = code?.code;
    }

    // 创建一个模块依赖，当 import 分析完后更新模块依赖
    mod = await moduleGraph.ensureEntryFromUrl(url);

    // 调用 transform 钩子转换代码
    if (code) {
      transformResult = await pluginContainer.transform(
        code,
        resolvedResult.id
      );
    }
  }

  // 添加进缓存
  if (mod) {
    mod.transformResult = transformResult;
  }

  return transformResult;
}

export function transformMiddleware(
  serverContext: ServerContext
): NextHandleFunction {
  return async (req, res, next) => {
    if (req.method !== "GET" || !req.url) {
      return next();
    }

    const url = req.url;

    // 如果是 js 请求 || 如果是 css 请求
    if (isJSRequest(url) || isCSSRequest(url) || isImportRequest(url)) {
      // 核心编译函数
      let result = await transformRequest(url, serverContext);

      if (!result) {
        return next();
      }

      let code;
      if (result && typeof result !== "string") {
        code = result.code;
      } else {
        code = result;
      }

      // 编译完成，返回响应给浏览器
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/javascript");
      return res.end(code);
    }

    return next();
  };
}
