import { deviceApi } from "@/api/device_api";
import { MobileModelList, MobileModelV3Info } from "@/api/device_define";

export interface MobileModelOption {
    label: string;
    value: number;
    meta?: MobileModelV3Info;
}

export interface MobileModelGroup {
    label: string;
    options: MobileModelOption[];
}

export const CUSTOM_MODEL_VALUE = -1;
// 品牌随机：交由后端随机选取机型（model_id <= 0 即随机），不需要指定具体机型
export const RANDOM_BRAND = "__random_brand__";
// 机型随机：在当前品牌下由前端随机选取一个具体机型
export const RANDOM_MODEL_VALUE = -2;

const modelListCache: Partial<Record<"v2" | "v3", MobileModelGroup[]>> = {};
const modelListPending: Partial<Record<"v2" | "v3", Promise<MobileModelGroup[]>>> = {};

function normalizeModelList(data: MobileModelList, version: "v2" | "v3", t: (key: string) => string): MobileModelGroup[] {
    const list = Object.entries(data).map(([brand, models]) => {
        const options = Object.entries(models).map(([name, value]) => {
            if (version === "v3") {
                const info = value as MobileModelV3Info;
                return { label: name, value: info.id, meta: info };
            }
            return { label: name, value: value as number };
        });
        return { label: brand, options };
    });
    list.splice(0, 0, {
        label: t("default"),
        options: [
            { label: t("custom"), value: CUSTOM_MODEL_VALUE },
        ],
    });
    return list;
}

export function pickRandomMobileModelOption(groups: MobileModelGroup[]): MobileModelOption | undefined {
    const options = groups
        .flatMap(group => group.options)
        .filter(option => option.value > 0);

    if (options.length === 0) {
        return;
    }

    const index = Math.floor(Math.random() * options.length);
    return options[index];
}

export async function getOrLoadMobileModelList(version: "v2" | "v3", t: (key: string) => string): Promise<MobileModelGroup[]> {
    const cache = modelListCache[version];
    if (cache) {
        return cache;
    }

    const pending = modelListPending[version];
    if (pending) {
        return pending;
    }

    const task = deviceApi.getModelList(version)
        .then(data => {
            const list = normalizeModelList(data, version, t);
            modelListCache[version] = list;
            return list;
        })
        .finally(() => {
            delete modelListPending[version];
        });

    modelListPending[version] = task;
    return task;
}
