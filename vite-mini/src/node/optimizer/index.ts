import path from "path";
import { build } from "esbuild";
import { green } from "picocolors";
import { scanPlugin } from "./scanPlugin";
import { preBundlePlugin } from "./preBundlePlugin";
import { PRE_BUNDLE_DIR } from "../constants";

export async function optimize(root: string) {
  // 1. 确定入口
  // 方便解析和理解预定入口为 src/main.tsx
  const entry = path.resolve("src/main.tsx");

  // 2. 从入口处扫描依赖
  // 记录依赖
  const deps = new Set<string>();
  // 使用 esbuild 打包，和 scanPlugin 插件扫描依赖
  await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    plugins: [scanPlugin(deps)],
  });
  console.log(
    `${green("需要预构建的依赖")}:\n${[...deps]
      .map(green)
      .map((item) => `  ${item}`)
      .join("\n")}`
  );

  // 3. 预构建依赖
  // 写一个打包查询，用于处理转换导出。
  await build({
    entryPoints: [...deps],
    write: true,
    bundle: true,
    format: "esm",
    splitting: true,
    outdir: path.resolve(root, PRE_BUNDLE_DIR),
    plugins: [preBundlePlugin(deps)],
  });
}
