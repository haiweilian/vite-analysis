import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

import { hello as hello1 } from '@/utils'
console.log(hello1)

// 测试导出 lodash 如果排除预构建的效果
import { debounceFn } from './lodash/debounce'
debounceFn()
debounceFn()
debounceFn()

// 这里使用了动态导入，如果运行的时候发现依赖会重新预构建，所以需要明确指定优化。
// ✨ new dependencies optimized: dayjs
// ✨ optimized dependencies changed. reloading
const importModule = (m: string) => import(`./locales/${m}.ts`);
importModule("zh_CN");

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
