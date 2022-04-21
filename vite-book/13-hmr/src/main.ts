import { render } from './render';
import { initState } from './state';

render();
initState();

if(import.meta.hot) {
  // 接收模块的更新
  import.meta.hot.accept(['./render.ts', './state.ts'], (modules) => {
    // console.log(modules)
    const [renderModule, stateModule] = modules;
    if (renderModule) {
      renderModule.render();
    }
    if (stateModule) {
      stateModule.initState();
    }
  })
}
