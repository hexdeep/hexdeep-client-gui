declare module "vue-virtual-scroller" {
  // 未提供官方类型声明，且在 TSX 中作为动态属性组件使用（items/minItemSize/keyField 等），
  // 用 any 放行以避免与 vue-tsx-support 的严格 JSX prop 校验冲突。
  export const RecycleScroller: any;
  export const DynamicScroller: any;
  export const DynamicScrollerItem: any;
}

declare module "vue-virtual-scroller/dist/vue-virtual-scroller.css";
