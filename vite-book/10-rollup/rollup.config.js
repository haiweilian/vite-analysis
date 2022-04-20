import { defineConfig } from 'rollup'
import * as path from 'path'
import alias from './plugins/alias'
import load from './plugins/load'
import replace from './plugins/replace'
import html from './plugins/html'

export default defineConfig({
  input: './src/index.js',
  output: {
    dir: './dist'
  },
  plugins: [
    alias({
      entries: [{
        find: 'module-a',
        replacement: path.resolve(__dirname, 'src/module-a.js') 
      }]
    }),
    load(),
    replace({
      __TEST__: true
    }),
    html()
  ]
})
