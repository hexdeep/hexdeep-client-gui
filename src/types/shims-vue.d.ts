
declare module "*.vue" {
  import Vue from "vue";
  export default Vue;
}

interface Dictionary<T = any> {
  [key: string]: T;
}

interface IVModelPorps {
  "v-model": string | number | null | undefined;
}
interface IValuePorps {
  value: string | number | null | undefined;
  onInput?(e: string): void;
}
type IModelPorps = IVModelPorps | IValuePorps;
interface IDefaultScoped {
  default: void;
}