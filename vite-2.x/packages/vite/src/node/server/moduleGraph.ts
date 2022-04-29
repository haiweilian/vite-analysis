import { extname } from 'path'
import type { ModuleInfo, PartialResolvedId } from 'rollup'
import { parse as parseUrl } from 'url'
import { isDirectCSSRequest } from '../plugins/css'
import {
  cleanUrl,
  normalizePath,
  removeImportQuery,
  removeTimestampQuery
} from '../utils'
import { FS_PREFIX } from '../constants'
import type { TransformResult } from './transformRequest'

export class ModuleNode {
  // 原始请求 url
  url: string
  // 文件绝对路径 + query
  id: string | null = null
  // 文件绝对路径
  file: string | null = null
  // 文件类型
  type: 'js' | 'css'
  // 模块信息
  info?: ModuleInfo
  // resolveId 钩子返回结果中的元数据
  meta?: Record<string, any>
  // 重要：该模块的引用方
  importers = new Set<ModuleNode>()
  // 重要：该模块所依赖的模块
  importedModules = new Set<ModuleNode>()
  // 接受更新的模块
  acceptedHmrDeps = new Set<ModuleNode>()
  // 是否为`接受自身模块`的更新
  isSelfAccepting?: boolean
  // 经过 transform 钩子后的编译结果
  transformResult: TransformResult | null = null
  // SSR 过程中经过 transform 钩子后的编译结果
  ssrTransformResult: TransformResult | null = null
  // SSR 过程中的模块信息
  ssrModule: Record<string, any> | null = null
  // 上一次热更新的时间戳
  lastHMRTimestamp = 0
  lastInvalidationTimestamp = 0

  constructor(url: string) {
    this.url = url
    this.type = isDirectCSSRequest(url) ? 'css' : 'js'
  }
}

function invalidateSSRModule(mod: ModuleNode, seen: Set<ModuleNode>) {
  if (seen.has(mod)) {
    return
  }
  seen.add(mod)
  mod.ssrModule = null
  mod.importers.forEach((importer) => invalidateSSRModule(importer, seen))
}

export type ResolvedUrl = [
  url: string,
  resolvedId: string,
  meta: object | null | undefined
]

// VITE-HMR 2-创建依赖图节点
// 什么是模块依赖图：
// 1、当前文件 import 了哪些文件
// 2、当前文件被哪个文件 import 了
// 3、两者互相建立关系形成依赖图
export class ModuleGraph {
  // 由原始请求 url 到模块节点的映射
  // /src/main.ts?type=x
  urlToModuleMap = new Map<string, ModuleNode>()

  // 由解析后路径 id 到模块节点的映射
  // /User/Project/src/main.ts?type=x
  idToModuleMap = new Map<string, ModuleNode>()

  // 由文件路径到模块节点的映射，一个文件可以依赖多个模块
  // /User/Project/src/main.ts
  // a single file may corresponds to multiple modules with different queries
  fileToModulesMap = new Map<string, Set<ModuleNode>>()

  // VITETODO
  safeModulesPath = new Set<string>()

  constructor(
    private resolveId: (
      url: string,
      ssr: boolean
    ) => Promise<PartialResolvedId | null>
  ) {}

  async getModuleByUrl(
    rawUrl: string,
    ssr?: boolean
  ): Promise<ModuleNode | undefined> {
    const [url] = await this.resolveUrl(rawUrl, ssr)
    return this.urlToModuleMap.get(url)
  }

  // 根据 id 获取
  getModuleById(id: string): ModuleNode | undefined {
    return this.idToModuleMap.get(removeTimestampQuery(id))
  }

  // 根据 file 获取
  getModulesByFile(file: string): Set<ModuleNode> | undefined {
    return this.fileToModulesMap.get(file)
  }

  // 当文件变化
  onFileChange(file: string): void {
    const mods = this.getModulesByFile(file)
    if (mods) {
      const seen = new Set<ModuleNode>()
      mods.forEach((mod) => {
        this.invalidateModule(mod, seen)
      })
    }
  }

  // 清楚模块的缓存
  invalidateModule(
    mod: ModuleNode,
    seen: Set<ModuleNode> = new Set(),
    timestamp: number = Date.now()
  ): void {
    // Save the timestamp for this invalidation, so we can avoid caching the result of possible already started
    // processing being done for this module
    mod.lastInvalidationTimestamp = timestamp
    // Don't invalidate mod.info and mod.meta, as they are part of the processing pipeline
    // Invalidating the transform result is enough to ensure this module is re-processed next time it is requested
    mod.transformResult = null
    mod.ssrTransformResult = null
    invalidateSSRModule(mod, seen)
  }

  // 清除所有的缓存
  invalidateAll(): void {
    const timestamp = Date.now()
    const seen = new Set<ModuleNode>()
    this.idToModuleMap.forEach((mod) => {
      this.invalidateModule(mod, seen, timestamp)
    })
  }

  /**
   * Update the module graph based on a module's updated imports information
   * If there are dependencies that no longer have any importers, they are
   * returned as a Set.
   */
  // 更新模块依赖图
  async updateModuleInfo(
    mod: ModuleNode,
    importedModules: Set<string | ModuleNode>,
    acceptedModules: Set<string | ModuleNode>,
    isSelfAccepting: boolean,
    ssr?: boolean
  ): Promise<Set<ModuleNode> | undefined> {
    mod.isSelfAccepting = isSelfAccepting
    const prevImports = mod.importedModules
    const nextImports = (mod.importedModules = new Set())
    let noLongerImported: Set<ModuleNode> | undefined

    // 遍历 `当前模块` 所 `依赖的模块`
    for (const imported of importedModules) {
      // 找到 `依赖模块` 的节点信息
      const dep =
        typeof imported === 'string'
          ? await this.ensureEntryFromUrl(imported, ssr)
          : imported

      // 把 `当前模块` 添加进 `依赖模块` 的 `模块的引用方` 里形成双向引用。
      dep.importers.add(mod)
      nextImports.add(dep)
    }

    // remove the importer from deps that were imported but no longer are.
    prevImports.forEach((dep) => {
      if (!nextImports.has(dep)) {
        dep.importers.delete(mod)
        if (!dep.importers.size) {
          // dependency no longer imported
          ;(noLongerImported || (noLongerImported = new Set())).add(dep)
        }
      }
    })

    // 遍历 `当前模块` 的 `接收热更新的模块`
    const deps = (mod.acceptedHmrDeps = new Set())
    for (const accepted of acceptedModules) {
      // 找到 `接收热更新模块` 的节点信息
      const dep =
        typeof accepted === 'string'
          ? await this.ensureEntryFromUrl(accepted, ssr)
          : accepted

      // 把 `接受更新的模块` 信息添加进 `当前模块` 的 `接受更新的模块`。
      deps.add(dep)
    }
    return noLongerImported
  }

  // 添加模块依赖图
  async ensureEntryFromUrl(rawUrl: string, ssr?: boolean): Promise<ModuleNode> {
    // 调用各个插件的 resolveId 钩子得到路径信息
    const [url, resolvedId, meta] = await this.resolveUrl(rawUrl, ssr)

    // 如果没有缓存，就创建新的 ModuleNode 对象
    // 并记录到 urlToModuleMap、idToModuleMap、fileToModulesMap 这三张表中
    let mod = this.urlToModuleMap.get(url)
    if (!mod) {
      mod = new ModuleNode(url)
      if (meta) mod.meta = meta
      // 以 url 记录
      this.urlToModuleMap.set(url, mod)

      // 以 id 记录
      mod.id = resolvedId
      this.idToModuleMap.set(resolvedId, mod)

      // 以文件路径记录，去除查询字符串
      const file = (mod.file = cleanUrl(resolvedId))
      let fileMappedModules = this.fileToModulesMap.get(file)
      if (!fileMappedModules) {
        fileMappedModules = new Set()
        this.fileToModulesMap.set(file, fileMappedModules)
      }
      fileMappedModules.add(mod)
    }
    return mod
  }

  // some deps, like a css file referenced via @import, don't have its own
  // url because they are inlined into the main css import. But they still
  // need to be represented in the module graph so that they can trigger
  // hmr in the importing css file.
  createFileOnlyEntry(file: string): ModuleNode {
    file = normalizePath(file)
    let fileMappedModules = this.fileToModulesMap.get(file)
    if (!fileMappedModules) {
      fileMappedModules = new Set()
      this.fileToModulesMap.set(file, fileMappedModules)
    }

    const url = `${FS_PREFIX}${file}`
    for (const m of fileMappedModules) {
      if (m.url === url || m.id === file) {
        return m
      }
    }

    const mod = new ModuleNode(url)
    mod.file = file
    fileMappedModules.add(mod)
    return mod
  }

  // for incoming urls, it is important to:
  // 1. remove the HMR timestamp query (?t=xxxx)
  // 2. resolve its extension so that urls with or without extension all map to
  // the same module
  // 解析 url 路径，删除查询字符串 t=xxxx 和补充扩展名
  async resolveUrl(url: string, ssr?: boolean): Promise<ResolvedUrl> {
    url = removeImportQuery(removeTimestampQuery(url))
    const resolved = await this.resolveId(url, !!ssr)
    const resolvedId = resolved?.id || url
    const ext = extname(cleanUrl(resolvedId))
    const { pathname, search, hash } = parseUrl(url)
    if (ext && !pathname!.endsWith(ext)) {
      url = pathname + ext + (search || '') + (hash || '')
    }
    return [url, resolvedId, resolved?.meta]
  }
}
