import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import * as path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/"),
    },
  },
  optimizeDeps: {
    // 排除预构建，这里只是作为测试，不要随意排除。
    // exclude: ['lodash-es'],

    // 手动指定预构建，这样动态引入的就会被预构建
    include: [
      // 动态加载的包
      "dayjs",
      "dayjs/locale/zh-cn",
      // 指定本地的文件目录
      '@/utils'
    ],
  },
});
