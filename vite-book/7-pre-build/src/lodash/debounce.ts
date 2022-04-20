import { debounce } from "lodash-es";

const fn = () => {
  console.log("...fn");
};

export const debounceFn = debounce(fn, 200);
