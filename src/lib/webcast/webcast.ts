import Vue from "vue";
import { CastCheckDialog } from "./check.dialog";

const hostBase = "http://localhost:28186";

export class WebCastPlugin {
    public static async startCast(vue: Vue) {
        const loading = vue.$loading({});
        try {
            const res = await fetchWithTimeout(`${hostBase}/status`, {}, 1000);
            const data = await res.json();
            if (data.status == "running") {
                await fetch(`${hostBase}/openPage`);
            }
        } catch (error) {
            vue.$dialog(CastCheckDialog).show();
        } finally {
            loading.close();
        }
    }
}

async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number = 5000
): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const { signal } = controller;

    const mergedOptions: RequestInit = {
        ...options,
        signal
    };

    return fetch(url, mergedOptions).finally(() => clearTimeout(id));
}