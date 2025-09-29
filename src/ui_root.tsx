import Vue from "vue";
import { Component } from "vue-property-decorator";
import s from "./styles/app.module.less";
import "./styles/tabs.less";
import "./styles/common.less";
import { version } from "../package.json";

@Component
export class UIRoot extends Vue {
  protected render() {
    return (
      <div class={s.app}>
        <router-view name="nav" class="nav" />
        <router-view class={s.body} />
        <div class={s.version}>{version}</div>
      </div>
    );
  }
}