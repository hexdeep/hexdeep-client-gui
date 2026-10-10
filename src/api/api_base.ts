import { Config } from "@/common/Config";
import { AxiosResponse } from "axios";
import urlJoin from "url-join";

/** super_sdk 响应里 code 不是 200 时抛出的错误，带上 code 供调用方做状态判断（而不是匹配 message 文本） */
export class ApiCodeError extends Error {
    constructor(message: string, public readonly code: number) {
        super(message);
        this.name = 'ApiCodeError';
    }
}

/** super_sdk 创建云机时，本机v3云机总数已达上限且未开通VIP的响应码（constants.ContainerLimitExceededCode） */
export const CONTAINER_LIMIT_EXCEEDED_CODE = 5;

export class ApiBase {
    protected async handleError(res: Response) {
        const text = await res.text();
        var json: any;
        try {
            json = JSON.parse(text);
        } catch (e: any) {
            throw new Error(e.message ?? text ?? "unknown error");
        }
        if (json.code !== 200) {
            throw new ApiCodeError(json.err ?? text ?? "unknown error", json.code);
        }
        return json.data;
    }

    protected async handleAxiosError(res: AxiosResponse) {
        var json: any = res.data;
        try {
            if (json.code !== 200) {
                throw new Error(json.err ?? "unknown error");
            }
            return json.data;
        } catch (e: any) {
            throw new Error(e.message ?? "unknown error");
        }
    }



}