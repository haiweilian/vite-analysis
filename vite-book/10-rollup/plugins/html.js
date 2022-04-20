import { Plugin } from "rollup";
import * as fs from 'fs'

/**
 * @type { () => Plugin }
 */
export default function html(options) {
  return {
    name: "rollup:html",
    // 打包的最后异步，对所有的 chunk 进行处理
    generateBundle(outputOptions, bundle) {
      // output 配置
      console.log('generateBundle...', outputOptions)
      // 所有的文件
      console.log('generateBundle...', bundle)

      // 获取要插入 html 的 js。
      const scripts = []
      Object.entries(bundle).forEach(([key, value]) => {
        if(key.endsWith('.js')) {
          scripts.push(`<script src="${key}"></script>`)
        }
      })

      // 写入 html 文件
      fs.writeFileSync(`${outputOptions.dir}/index.html`, `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  ${scripts.join('\n')}
</body>
</html>
`)
    }
  };
}
