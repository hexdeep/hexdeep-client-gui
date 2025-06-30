import "@/common/NumberExtends";
import "@/lib/object-extends";
import 'element-ui/lib/theme-chalk/index.css';
import Vue from "vue";
import VueRouter from "vue-router";
import { Config } from "./common/Config";
import { i18n } from "./i18n/i18n";
import './install_eleui';
import { DialogPlugin } from "./lib/dialog/dialog";
import { router } from "./routes/router";
import { UIRoot } from "./ui_root";

if (process.env.NODE_ENV == "development") {
    console.log("development mode");
    Vue.config.devtools = true;
}

Vue.use(VueRouter);
Vue.use(DialogPlugin);
document.title = Config.title;
console.log("current browser version" + navigator.appVersion);


new Vue({
    i18n,
    router,
    render: h => h(UIRoot),
}).$mount("#app");