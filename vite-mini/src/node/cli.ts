// cac https://github.com/cacjs/cac#readme 一个用来定义命令行的工具包
import cac from "cac";
import { startDevServer } from "./server";

const cli = cac();

cli
  .command("[root]", "运行开发模式")
  .alias("serve")
  .alias("dev")
  .action(async () => {
    // console.log("测试 cli 工具");
    await startDevServer();
  });

cli.help();

cli.parse();
