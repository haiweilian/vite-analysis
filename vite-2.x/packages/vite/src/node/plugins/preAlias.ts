import type { ViteDevServer } from '..'
import type { Plugin } from '../plugin'
import { bareImportRE } from '../utils'
import { tryOptimizedResolve } from './resolve'

/**
 * A plugin to avoid an aliased AND optimized dep from being aliased in src
 */
// 将 bare import 路径重定向到预构建依赖的路径
// 如 import React from 'react'; ==> import React from '/node_modules/.vite/react.js'
export function preAliasPlugin(): Plugin {
  let server: ViteDevServer
  return {
    name: 'vite:pre-alias',
    configureServer(_server) {
      server = _server
    },
    async resolveId(id, importer, options) {
      if (!options?.ssr && bareImportRE.test(id) && !options?.scan) {
        return await tryOptimizedResolve(id, server, importer)
      }
    }
  }
}
