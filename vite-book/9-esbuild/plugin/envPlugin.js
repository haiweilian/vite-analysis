let envPlugin = {
  name: 'env',
  setup(build) {
    // 控制路径解析
    // https://esbuild.github.io/plugins/#on-resolve
    // 我们使用 filter 匹配导入路径为 env 的， 最后可以返回虚拟的模块名称 namespace
    build.onResolve({ filter: /^env$/ }, args => {
      // 模块路径
      console.log('模块路径：', args.path)
      // 父模块路径
      console.log('父模块路径：', args.importer)
      // namespace 标识
      console.log('标识：',args.namespace)
      // 基准路径
      console.log('基准路径：',args.resolveDir)
      // 导入方式，如 import、require
      console.log('导入方式：', args.kind)
      // 额外绑定的插件数据
      console.log('额外绑定的插件数据：',args.pluginData)

      return {
        // 错误信息
        errors: [],
        // 是否需要 external
        external: false,
        // namespace 标识
        namespace: 'env-ns',
        // 模块路径
        path: args.path,
        // 额外绑定的插件数据
        pluginData: null,
        // 插件名称
        pluginName: 'xxx',
        // 设置为 false，如果模块没有被用到，模块代码将会在产物中会删除。否则不会这么做
        sideEffects: false,
        // 添加一些路径后缀，如`?xxx`
        suffix: '?xxx',
        // 警告信息
        warnings: [],
        // 仅仅在 Esbuild 开启 watch 模式下生效
        // 告诉 Esbuild 需要额外监听哪些文件/目录的变化
        watchDirs: [],
        watchFiles: []
      }
    })

    // 控制内容加载
    // https://esbuild.github.io/plugins/#on-load
    // 在这里我们过滤所有的导入，并且 namespace 是 env-ns 也就是上面定义的，最后我们可以返回虚拟模块的内容。
    build.onLoad({ filter: /.*/, namespace: 'env-ns' }, (args) => {
      // 模块路径
      console.log(args.path);
      // namespace 标识
      console.log(args.namespace);
      // 后缀信息
      console.log(args.suffix);
      // 额外的插件数据
      console.log(args.pluginData);
      return {
        loader: 'json',
        // 模块具体内容
        contents: JSON.stringify(process.env),
        // 错误信息
        errors: [],
        // 指定 loader，如`js`、`ts`、`jsx`、`tsx`、`json`等等
        loader: 'json',
        // 额外的插件数据
        pluginData: null,
        // 插件名称
        // pluginName: 'xxx',
        // 基准路径
        // resolveDir: './dir',
        // 警告信息
        warnings: [],
        // 同上
        watchDirs: [],
        watchFiles: []
      }  
    })

    // 解析开启
    build.onStart(() => {
      console.log('build started')
    });

    // 解析结束
    build.onEnd((buildResult) => {
      if (buildResult.errors.length) {
        return;
      }
      // 构建元信息
      // 获取元信息后做一些自定义的事情，比如生成 HTML
      console.log('构建信息',buildResult.metafile)
    })
  },
}

module.exports = envPlugin

// require('esbuild').build({
//   entryPoints: ['src/index.jsx'],
//   bundle: true,
//   outfile: 'out.js',
//   write: true,
//   // 应用插件
//   plugins: [envPlugin],
// }).catch(() => process.exit(1))
