// 负责记录当前的页面状态

let timer: number | undefined

if(import.meta.hot) {
  // 模块销毁时的逻辑
  import.meta.hot.dispose(() => {
    if(timer) {
      clearInterval(timer)
    }
  })

  // // 共享数据
  if(!import.meta.hot.data.count) {
    import.meta.hot.data.count = 0
  }
}

export function initState() {
  const getAndIncCount = () => {
    const data = import.meta.hot?.data || {
      count: 0
    };
    data.count = data.count + 1;
    return data.count;
  };

  timer = setInterval(() => {
    let countEle = document.getElementById('count');
    countEle!.innerText =  getAndIncCount() + '-';
  }, 1000);
}
