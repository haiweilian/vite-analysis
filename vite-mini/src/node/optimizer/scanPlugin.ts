import { Plugin } from "esbuild";
import { BARE_IMPORT_RE, EXTERNAL_TYPES } from "../constants";

export function scanPlugin(deps: Set<string>): Plugin {
  return {
    name: "esbuild:scan-deps",
    setup(build) {
      // 忽略的文件类型，排除不进行记录
      // 解析钩子
      build.onResolve(
        {
          filter: new RegExp(`\\.(${EXTERNAL_TYPES.join("|")})$`),
        },
        (resolveInfo) => {
          return {
            path: resolveInfo.path,
            // 打上外部排除标记
            external: true,
          };
        }
      );

      // 解析 bare import 导入
      // bare import即直接写一个第三方包名，如react、lodash
      build.onResolve(
        {
          filter: BARE_IMPORT_RE,
        },
        (resolveInfo) => {
          const { path: id } = resolveInfo;
          // 记录到 deps 中
          deps.add(id);
          return {
            path: id,
            external: true,
          };
        }
      );
    },
  };
}
