// connect 是一个具有中间件机制的轻量级 Node.js 框架。
// 既可以单独作为服务器，也可以接入到任何具有中间件机制的框架中，如 Koa、Express
import connect from "connect";
// 文件监听工具
import chokidar, { FSWatcher } from "chokidar";
// picocolors 是一个用来在命令行显示不同颜色文本的工具
import { blue, green } from "picocolors";
import { optimize } from "../optimizer";
import { resolvePlugins } from "../plugins";
import { createPluginContainer, PluginContainer } from "../pluginContainer";
import { Plugin } from "../plugin";
import { indexHtmlMiddware } from "./middlewares/indexHtml";
import { transformMiddleware } from "./middlewares/transform";
import { staticMiddleware } from "./middlewares/static";
import { ModuleGraph } from "../ModuleGraph";
import { createWebSocketServer } from "../ws";
import { bindingHMREvents } from "../hmr";

export interface ServerContext {
  root: string;
  pluginContainer: PluginContainer;
  app: connect.Server;
  plugins: Plugin[];
  moduleGraph: ModuleGraph;
  ws: { send: (data: any) => void; close: () => void };
  watcher: FSWatcher;
}

export async function startDevServer() {
  const app = connect();
  const root = process.cwd();
  const startTime = Date.now();
  const ws = createWebSocketServer(app);

  // 获取插件
  const plugins = resolvePlugins();

  // 创建容器
  const pluginContainer = createPluginContainer(plugins);

  // 构建模块依赖图，放到上下文上方便使用
  const moduleGraph = new ModuleGraph((url) => pluginContainer.resolveId(url));

  // 创建监听服务
  const watcher = chokidar.watch(root, {
    ignored: ["**/node_modules/**", "**/.git/**"],
    ignoreInitial: true,
  });

  // 开发服务上下文
  const serverContext: ServerContext = {
    root: process.cwd(),
    app,
    pluginContainer,
    plugins,
    moduleGraph,
    ws,
    watcher,
  };

  // 调用插件的 configureServer 钩子
  for (const plugin of plugins) {
    if (plugin.configureServer) {
      await plugin.configureServer(serverContext);
    }
  }

  app.use(indexHtmlMiddware(serverContext));
  app.use(transformMiddleware(serverContext));
  app.use(staticMiddleware());

  bindingHMREvents(serverContext);

  app.listen(3000, async () => {
    // 执行预构建
    await optimize(root);

    console.log(
      green("🚀 服务已经成功启动!"),
      `耗时: ${Date.now() - startTime}ms`
    );

    console.log(`> 本地访问路径: ${blue("http://localhost:3000")}`);
  });
}
