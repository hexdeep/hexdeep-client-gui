import "@/common/NumberExtends";
import "@/lib/object-extends";
import 'element-ui/lib/theme-chalk/index.css';
import Vue from "vue";
import VueRouter from "vue-router";
import { deviceApi } from "./api/device_api";
import { Config } from "./common/Config";
import { i18n } from "./i18n/i18n";
import './install_eleui';
import { DialogPlugin } from "./lib/dialog/dialog";
import { router } from "./routes/router";
import { UIRoot } from "./ui_root";
import "@/tailwind.css";


if (process.env.NODE_ENV == "development") {
    console.log("development mode");
    Vue.config.devtools = true;
}

Vue.use(VueRouter);
Vue.use(DialogPlugin);
document.title = Config.title;
console.log("current browser version" + navigator.appVersion);

document.addEventListener("submit", (e) => {
    e.preventDefault();
});

const app = new Vue({
    i18n,
    router,
    render: h => h(UIRoot),
}).$mount("#app");

deviceApi.checkDisk(Config.host).catch((e: any) => {
    app.$message.error(e?.message ?? "存储检测异常");
});
