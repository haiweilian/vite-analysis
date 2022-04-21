// 负责渲染文本内容
import './style.css'

// if(import.meta.hot) {
//   import.meta.hot.accept(mod => mod.render())
// }

export const render = () => {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <h1>Hello Vite!</h1>
    <p target="_blank">This is hmr test.123</p>
  `
}
