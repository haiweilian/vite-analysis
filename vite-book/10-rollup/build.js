const rollup = require('rollup')
const util = require('util')

async function build () {
  // 解析为 ast，构建依赖视图
  const bundle = await rollup.rollup({
    input: ['./src/index-build.js'],
  })

  console.log(bundle)
  // console.log(bundle.cache.modules)

  // 打包但不写入文件
  // const result = await bundle.generate({
  //   format: 'esm',
  //   banner: '/* 头部信息 */',
  //   footer: '/* 尾部信息 */',
  // })

  // 打包并写入本地文件
  const result = await bundle.write({
    format: 'esm',
    dir: './dist',
    banner: '/* 头部信息 */',
    footer: '/* 尾部信息 */',
  })

  console.log(result)
}

build()
