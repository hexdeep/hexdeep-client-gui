import { deviceApi } from "@/api/device_api";
import { MobileModelDimensions, MobileModelInfo, MobileModelList } from "@/api/device_define";

export interface MobileModelOption {
    label: string;
    value: number;
    meta?: MobileModelDimensions;
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
            if (typeof value === "object") {
                const info = value as MobileModelInfo;
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

/**
 * 将表单内部的机型选择状态规范化为后端 API 字段（创建/批量创建）。
 * 后端语义（super_sdk GetRandDevPathWithSource）：
 *  - mobile_model_source 非空 => 自定义机型（"random" 由后端随机选取，否则视为主机上的绝对路径），优先级最高；
 *  - mobile_model_source 为空 => 预设机型：model_id>0 固定机型；model_id<=0 随机，
 *    此时 model_manufacturer 非空则限定在该品牌内随机，为空则全部品牌随机。
 * 前端内部仍用 model_id === CUSTOM_MODEL_VALUE(-1) 作为「自定义」标记，这里在提交时转换。
 */
export function normalizeModelSubmitFields(obj: {
    model_id?: number;
    model_manufacturer?: string;
    mobile_model_source?: string;
}) {
    const isCustom = Number(obj.model_id ?? 0) === CUSTOM_MODEL_VALUE;
    if (isCustom) {
        // 自定义机型：来源为空表示随机，转为后端约定的 "random"
        obj.mobile_model_source = obj.mobile_model_source || "random";
        obj.model_id = 0;
        delete obj.model_manufacturer;
        return;
    }
    // 预设机型：不发送自定义来源
    delete obj.mobile_model_source;
    if (Number(obj.model_id ?? 0) > 0) {
        // 指定具体机型，品牌无意义
        delete obj.model_manufacturer;
    } else {
        obj.model_id = 0; // 随机机型，交由后端选取
        if (!obj.model_manufacturer) delete obj.model_manufacturer; // 空品牌 = 全部品牌随机
    }
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
