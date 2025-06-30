import { Component } from 'vue-property-decorator';
import VueRouter, { RawLocation } from "vue-router";

Component.registerHooks(['beforeRouteEnter', 'beforeRouteLeave', 'beforeRouteUpdate']);
const nav = () => import("@/pages/nav/nav");

export const router = new VueRouter({
    mode: "history",
    routes: [
        // {
        //     name: "login",
        //     path: "/login",
        //     component: () => import("../pages/login/login"),
        //     meta: {
        //         showNav: false,
        //         showHeader: false,
        //     },
        // },
        {
            name: "home",
            path: "/",
            redirect: { name: "vm" },
        },
        {
            name: "vm",
            path: "/vm",
            components: {
                nav,
                default: () => import("../pages/vm/vm"),
            },
        },
        {
            name: "instance",
            path: "/instance",
            components: {
                nav,
                default: () => import("../pages/instance/instance"),
            },
        },
        {
            name: "machine",
            path: "/machine",
            components: {
                nav,
                default: () => import("../pages/machine/machine"),
            }
        },
        {
            name: "order",
            path: "/order",
            components: {
                nav,
                default: () => import("../pages/order/order"),
            }
        },
        {
            name: "404",
            path: "/*",
            component: () => import("@/pages/error_page"),
            meta: {
                showNav: false,
                showHeader: false,
            },
            props: {
                error: "404:Page not found"
            },
        },
    ]
});

VueRouter.prototype.maybeBack = function (this: VueRouter, location?: RawLocation) {
    if (location && window.history.length == 1) {
        this.replace(location);
    } else {
        this.back();
    }
};

router.beforeEach((to, from, next) => {
    // if (to.name != "login") {
    //     next({ name: "login", query: { redirect: to.fullPath } });
    // } else {
    //     next();
    // }
    next();
});

declare module 'vue-router/types/router' {
    interface VueRouter {
        maybeBack(location?: RawLocation): void;
    }
}
