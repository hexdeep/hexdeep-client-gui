
import zh from "@/i18n/zh.json";
import en from "@/i18n/en.json";
import VueI18n from 'vue-i18n';
import Vue from "vue";

export const i18n = (() => {
    Vue.use(VueI18n);
    return new VueI18n({
        locale: localStorage.getItem("lang") ?? "zh",
        fallbackLocale: 'en',
        silentTranslationWarn: true,
        messages: { zh, en }
    });
})();