import path from 'path'
import type { Plugin, ImportKind } from 'esbuild'
import { KNOWN_ASSET_TYPES } from '../constants'
import type { ResolvedConfig } from '..'
import {
  isRunningWithYarnPnp,
  flattenId,
  normalizePath,
  isExternalUrl,
  moduleListContains
} from '../utils'
import { browserExternalId } from '../plugins/resolve'
import type { ExportsData } from '.'

const externalTypes = [
  'css',
  // supported pre-processor types
  'less',
  'sass',
  'scss',
  'styl',
  'stylus',
  'pcss',
  'postcss',
  // known SFC types
  'vue',
  'svelte',
  'marko',
  'astro',
  // JSX/TSX may be configured to be compiled differently from how esbuild
  // handles it by default, so exclude them as well
  'jsx',
  'tsx',
  ...KNOWN_ASSET_TYPES
]

export function esbuildDepPlugin(
  qualified: Record<string, string>,
  exportsData: Record<string, ExportsData>,
  config: ResolvedConfig
): Plugin {
  // remove optimizable extensions from `externalTypes` list
  const allExternalTypes = config.optimizeDeps.extensions
    ? externalTypes.filter(
        (type) => !config.optimizeDeps.extensions?.includes('.' + type)
      )
    : externalTypes

  // default resolver which prefers ESM
  const _resolve = config.createResolver({ asSrc: false, scan: true })

  // cjs resolver that prefers Node
  const _resolveRequire = config.createResolver({
    asSrc: false,
    isRequire: true,
    scan: true
  })

  const resolve = (
    id: string,
    importer: string,
    kind: ImportKind,
    resolveDir?: string
  ): Promise<string | undefined> => {
    let _importer: string
    // explicit resolveDir - this is passed only during yarn pnp resolve for
    // entries
    if (resolveDir) {
      _importer = normalizePath(path.join(resolveDir, '*'))
    } else {
      // map importer ids to file paths for correct resolution
      _importer = importer in qualified ? qualified[importer] : importer
    }
    const resolver = kind.startsWith('require') ? _resolveRequire : _resolve
    return resolver(id, _importer, undefined)
  }

  return {
    name: 'vite:dep-pre-bundle',
    setup(build) {
      // externalize assets and commonly known non-js file types
      // 排除非 js 类型的
      build.onResolve(
        {
          filter: new RegExp(`\\.(` + allExternalTypes.join('|') + `)(\\?.*)?$`)
        },
        async ({ path: id, importer, kind }) => {
          const resolved = await resolve(id, importer, kind)
          if (resolved) {
            return {
              path: resolved,
              external: true
            }
          }
        }
      )

      // 是否是入口标记为虚拟模块
      function resolveEntry(id: string) {
        const flatId = flattenId(id)
        if (flatId in qualified) {
          return {
            path: flatId,
            namespace: 'dep'
          }
        }
      }

      build.onResolve(
        { filter: /^[\w@][^:]/ },
        async ({ path: id, importer, kind }) => {
          // 排除
          if (moduleListContains(config.optimizeDeps?.exclude, id)) {
            return {
              path: id,
              external: true
            }
          }

          // ensure esbuild uses our resolved entries
          let entry: { path: string; namespace: string } | undefined
          // if this is an entry, return entry namespace resolve result
          // 判断是否为入口模块，如果是，则标记上`dep`的 namespace，成为一个虚拟模块
          if (!importer) {
            if ((entry = resolveEntry(id))) return entry
            // check if this is aliased to an entry - also return entry namespace
            const aliased = await _resolve(id, undefined, true)
            if (aliased && (entry = resolveEntry(aliased))) {
              return entry
            }
          }

          // use vite's own resolver
          const resolved = await resolve(id, importer, kind)
          if (resolved) {
            if (resolved.startsWith(browserExternalId)) {
              return {
                path: id,
                namespace: 'browser-external'
              }
            }
            if (isExternalUrl(resolved)) {
              return {
                path: resolved,
                external: true
              }
            }
            return {
              path: path.resolve(resolved)
            }
          }
        }
      )

      // For entry files, we'll read it ourselves and construct a proxy module
      // to retain the entry's raw id instead of file path so that esbuild
      // outputs desired output file structure.
      // It is necessary to do the re-exporting to separate the virtual proxy
      // module from the actual module since the actual module may get
      // referenced via relative imports - if we don't separate the proxy and
      // the actual module, esbuild will create duplicated copies of the same
      // module!
      // 代理模块：不直接打包依赖先创建一个代理的文件，在代理某块里重新导出
      // 为什么要做代理呢：
      // 比如 vue 和 vue-router：
      // 其中 vue-router 使用了 import xx from 'vue'
      // 在预构建的结果 vue.js 和 vue-router.js 引用的同一份原始 vue 内容。而不是两份
      const root = path.resolve(config.root)
      build.onLoad({ filter: /.*/, namespace: 'dep' }, ({ path: id }) => {
        // 获取真实路径 vue: '/User/Project/node_modules/vue/index.js',
        const entryFile = qualified[id]

        // 获取相对路径 node_modules/vue/index.js
        let relativePath = normalizePath(path.relative(root, entryFile))
        if (
          !relativePath.startsWith('./') &&
          !relativePath.startsWith('../') &&
          relativePath !== '.'
        ) {
          relativePath = `./${relativePath}`
        }

        let contents = ''
        // 拿到对应模块的导入和导出
        const data = exportsData[id]
        const [imports, exports] = data
        // 如果没有导入也没有导出是 CommonJS
        if (!imports.length && !exports.length) {
          // cjs
          contents += `export default require("${relativePath}");`
        } else {
          // esm 默认导出
          if (exports.includes('default')) {
            contents += `import d from "${relativePath}";export default d;`
          }
          // 非默认导出
          if (
            data.hasReExports ||
            exports.length > 1 ||
            exports[0] !== 'default'
          ) {
            contents += `\nexport * from "${relativePath}"`
          }
        }

        return {
          loader: 'js',
          contents,
          resolveDir: root
        }
      })

      build.onLoad(
        { filter: /.*/, namespace: 'browser-external' },
        ({ path: id }) => {
          return {
            contents:
              `export default new Proxy({}, {
  get() {
    throw new Error('Module "${id}" has been externalized for ` +
              `browser compatibility and cannot be accessed in client code.')
  }
})`
          }
        }
      )

      // yarn 2 pnp compat
      if (isRunningWithYarnPnp) {
        build.onResolve(
          { filter: /.*/ },
          async ({ path, importer, kind, resolveDir }) => ({
            // pass along resolveDir for entries
            path: await resolve(path, importer, kind, resolveDir)
          })
        )
        build.onLoad({ filter: /.*/ }, async (args) => ({
          contents: await require('fs').promises.readFile(args.path),
          loader: 'default'
        }))
      }
    }
  }
}
