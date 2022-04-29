import type { ResolvedConfig } from '../config'
import type { Plugin } from '../plugin'
import aliasPlugin from '@rollup/plugin-alias'
import { jsonPlugin } from './json'
import { resolvePlugin } from './resolve'
import { optimizedDepsPlugin } from './optimizedDeps'
import { esbuildPlugin } from './esbuild'
import { importAnalysisPlugin } from './importAnalysis'
import { cssPlugin, cssPostPlugin } from './css'
import { assetPlugin } from './asset'
import { clientInjectionsPlugin } from './clientInjections'
import { buildHtmlPlugin, htmlInlineProxyPlugin } from './html'
import { wasmPlugin } from './wasm'
import { modulePreloadPolyfillPlugin } from './modulePreloadPolyfill'
import { webWorkerPlugin } from './worker'
import { preAliasPlugin } from './preAlias'
import { definePlugin } from './define'
import { ssrRequireHookPlugin } from './ssrRequireHook'
import { workerImportMetaUrlPlugin } from './workerImportMetaUrl'
import { ensureWatchPlugin } from './ensureWatch'
import { metadataPlugin } from './metadata'

// VITE-插件容器 2-生成插件集合
// 下面所有的内置插件都能在官网文档找到对应的配置和详细说明，插件的具体实现不做过多分析。
// tip: 这里的插件配置在开发环境下传给 vite 的插件容器，生成环境中传入 rollup.plugins
export async function resolvePlugins(
  config: ResolvedConfig,
  prePlugins: Plugin[],
  normalPlugins: Plugin[],
  postPlugins: Plugin[]
): Promise<Plugin[]> {
  const isBuild = config.command === 'build'
  const isWatch = isBuild && !!config.build.watch

  // 生产环境使用的插件
  const buildPlugins = isBuild
    ? (await import('../build')).resolveBuildPlugins(config)
    : { pre: [], post: [] }

  return [
    // 监听文件插件
    isWatch ? ensureWatchPlugin() : null,

    // 添加文件元数据插件
    isBuild ? metadataPlugin() : null,

    // -1、别名插件
    // 将 bare import 路径重定向到预构建依赖的路径
    isBuild ? null : preAliasPlugin(),

    // 路径别名功能 resolve.alias 配置
    aliasPlugin({ entries: config.resolve.alias }),

    // -2、带有 enforce: 'pre' 的用户插件
    ...prePlugins,

    // -3、Vite 核心插件：css/html/json/...
    // 是否注入 module preload 的兼容代码
    config.build.polyfillModulePreload
      ? modulePreloadPolyfillPlugin(config)
      : null,

    // 路径解析插件如果查找文件的路径
    resolvePlugin({
      ...config.resolve,
      root: config.root,
      isProduction: config.isProduction,
      isBuild,
      packageCache: config.packageCache,
      ssrConfig: config.ssr,
      asSrc: true
    }),

    // todo
    isBuild ? null : optimizedDepsPlugin(),

    // 内联脚本加载插件
    htmlInlineProxyPlugin(config),

    // CSS 编译插件，css预处理/CSS Modules/Postcss 编译
    cssPlugin(config),

    // 使用 esbuild 转换 js/ts https://cn.vitejs.dev/config/#esbuild
    config.esbuild !== false ? esbuildPlugin(config.esbuild) : null,

    // 用来加载 JSON 文件
    jsonPlugin(
      {
        namedExports: true,
        ...config.json
      },
      isBuild
    ),

    // 用来加载 .wasm 格式的文件
    wasmPlugin(config),

    // 用来加载 Web Worker 脚本
    webWorkerPlugin(config),

    // 静态资源的加载
    assetPlugin(config),

    // 4、没有 enforce 值的用户插件
    ...normalPlugins,

    // 5、Vite 核心插件
    // 提供全局变量替换功能
    definePlugin(config),

    // CSS 后处理插件
    cssPostPlugin(config),

    // todo
    config.build.ssr ? ssrRequireHookPlugin(config) : null,

    // html 处理插件会调用带有 transformIndexHtml 钩子的插件
    isBuild && buildHtmlPlugin(config),

    // todo
    workerImportMetaUrlPlugin(config),

    // Vite 构建用的插件
    ...buildPlugins.pre,

    // 6、带有 enforce: 'post' 的用户插件
    ...postPlugins,

    // 7、Vite 后置构建插件（最小化，manifest，报告）
    ...buildPlugins.post,

    // internal server-only plugins are always applied after everything else
    // 8、开发阶段特有的插件
    ...(isBuild
      ? []
      : [
          // 在 server/middlewares/indexHtml.ts 的 177 会注入一段代码 client/client.ts
          // 这个插件用来替换 client/client.ts 脚本中的__MODE__、__BASE__、__DEFINE__等等字符串替换为运行时的变量
          clientInjectionsPlugin(config),

          // import 导入分析，比如建立模块依赖图用于热更新
          importAnalysisPlugin(config)
        ])
  ].filter(Boolean) as Plugin[]
}
