
import { makeHostVmApiUrl, makeMacvlanVmApiUrl, makeVmApiUrl } from "@/common/common";
import { Config } from "@/common/Config";
import axios, { AxiosProgressEvent } from "axios";
import qs from 'qs';
import { ApiBase } from "./api_base";
import { CloneVmParam, CreateParam, IscsiInfo, SwapInfo, DeviceDetail, DiscoverInfo, DeviceInfo, DockerEditParam, FilelistInfo, HostDetailInfo, HostInfo, ImageInfo, S5setParam, SDKImagesRes, DiskListInfo, ClearGarbageReq, FirmwareVersionInfo, BatchCreateResponse, MobileModelList, MobileModelFile, DockerImageUsageInfo, NvmeInfo, StartupInfo, StartupRestartPolicy } from "./device_define";
import { Completer } from "@/lib/completer";
import { decamelizeKeys } from 'humps';

// VIP镜像受限错误
export class VipImageRestrictedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'VipImageRestrictedError';
    }
}

// 用户主动取消镜像拉取，不属于失败，调用方不应该按错误提示
export class PullImageAbortError extends Error {
    constructor() {
        super("canceled");
        this.name = 'PullImageAbortError';
    }
}

/**
 * 取出 image_api/pull_progress 响应体末尾的 JSON 报文。
 * 响应体前半段是进度字节(固定为 0x00/0x01，JSON 文本里不会出现这两个字节)，
 * 因此从尾部往前找到第一个进度字节，其后就是服务端追加的 util.Msg。
 * 只有进度字节（或响应被截断）时返回 undefined，按成功处理。
 */
function parsePullProgressResult(buf: ArrayBuffer | null): { code: number; err?: string } | undefined {
    if (!buf || buf.byteLength === 0) return undefined;
    const bytes = new Uint8Array(buf);
    let i = bytes.length - 1;
    while (i >= 0 && bytes[i] !== 0x00 && bytes[i] !== 0x01) i--;
    const tail = bytes.subarray(i + 1);
    if (tail.length === 0) return undefined;
    try {
        return JSON.parse(new TextDecoder().decode(tail).trim());
    } catch {
        return undefined;
    }
}

class DeviceApi extends ApiBase {
    private fileListInfo!: FilelistInfo;
    public async queryS5(hostIp: string, name: string) {
        const result = await fetch(makeVmApiUrl("and_api/proxy_query", hostIp, name));
        return await decamelizeKeys(this.handleError(result));
        // let re: S5setParam = { dns_mode: obj.domain_mode };
        // try {
        //     let url = new URL(obj.addr);
        //     return { s5_domain_mode: obj.domain_mode, s5_ip: url.hostname, s5_port: url.port, s5_user: url.username, s5_pwd: url.password };
        // } catch (e) {
        //     console.warn(e);
        // }
        // return re;
    }

    public async queryS5Macvlan(android_sdk: string): Promise<S5setParam> {
        const result = await fetch(makeMacvlanVmApiUrl("and_api/proxy_query", android_sdk));
        let obj = await this.handleError(result);
        //  obj.engine = Math.max(1, Math.min(2, obj.engine || 1));
        obj.protocol_type = Math.max(1, Math.min(4, obj.protocol_type || 1));
        try {
            if (obj.address) obj.address = atob(obj.address);
        } catch (e) {
            console.warn(e);
        }
        obj.password = obj.password || (obj as any).passwd;
        return await decamelizeKeys(obj);
    }

    public async cloneVm(hostIp: string, name: string, item: CloneVmParam) {
        const result = await fetch(makeVmApiUrl("dc_api/move", hostIp, name, item.index.toString(), item.dst_name));
        return await this.handleError(result);
    }

    public uploadToHost(
        hostIp: string,
        file: any,
        progress: (progressEvent: ProgressEvent) => void
    ): { promise: Promise<any>, cancel: () => void; } {
        const xhr = new XMLHttpRequest();

        const promise = new Promise((resolve, reject) => {
            const url = makeVmApiUrl("host/upload", hostIp);
            xhr.open("POST", url, true);

            // 上传进度回调
            xhr.upload.onprogress = progress;

            // 成功处理
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const json = JSON.parse(xhr.responseText);
                        if (json.code == 200) {
                            resolve(json.data);
                        } else {
                            reject(new Error(json.err));
                        }
                    } catch (e) {
                        reject(new Error("Invalid JSON response"));
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                }
            };

            // 错误处理
            xhr.onerror = () => reject(new Error("Network error during upload"));
            xhr.onabort = () => reject("aborted");

            const formData = new FormData();
            formData.append("index", "0");
            formData.append("total", "1");
            formData.append("chunk", file instanceof File ? file : file.raw);

            xhr.send(formData);
        });

        // 提供取消方法
        const cancel = () => {
            xhr.abort();
        };

        return { promise, cancel };
    }

    public async importDocker(hostIp: string, index: number, name: string, path: string) {
        const result = await fetch(makeVmApiUrl("dc_api/import", hostIp, index.toString(), name) + `?local=${encodeURIComponent(path)}`);
        return await this.handleError(result);
    }
    public async exportDocker(hostIp: string, name: string) {
        const result = await fetch(makeVmApiUrl("dc_api/export", hostIp, name));
        return await this.handleError(result);
    }

    public async rebootSDK(ip: string) {
        const result = await fetch(makeHostVmApiUrl("super_sdk/restart", ip));
        return await this.handleError(result);
    }

    public async getAllDevices() {
        var result = await deviceApi.getHosts();
        var tasks: Promise<DeviceInfo[]>[] = [];
        result.forEach(element => {
            var t = this.getDeviceListByHost(element);

            t.then(e => element.devices = (e ?? []).map(e => {
                e.hostIp = element.address;
                e.hostId = element.device_id;
                e.key = `${element.address}-${e.index}-${e.name}`;
                return e;
            })).catch(error => {
                console.log(error);
                element.has_error = true;
                element.devices = [];
            });
            tasks.push(t);

            this.getHostRemark(element.address).then(e => {
                element.remark = e;
            }).catch(error => {
                console.log(error);
            });
        });
        //console.log("await all");
        await Promise.allSettled(tasks).catch(e => {
            console.log(e);
        });
        // console.log("all done");
        return result;
    }

    public async getModelList(version: "v2" | "v3" = "v2"): Promise<MobileModelList> {
        const fileName = version === "v2" ? "cfg_v2.txt" : "cfg.txt";
        const result = await fetch(`https://download.hexdeep.com/mobile_cfgs/${version}/${fileName}`);
        const json = await result.json();
        return json;
    }

    private makeMobileModelUrl(ip: string, act: 0 | 1 | 2, version: "v2" | "v3", path?: string) {
        const url = makeVmApiUrl("host/mobile_model", ip);
        url.searchParams.set("act", act.toString());
        url.searchParams.set("mobile_model_version", version);
        if (path) url.searchParams.set("path", path);
        return url;
    }

    // 上传自定义机型文件到主机，返回主机上的绝对路径
    public async uploadMobileModel(ip: string, version: "v2" | "v3", file: File): Promise<MobileModelFile[]> {
        const formData = new FormData();
        formData.append("file", file);
        const result = await fetch(this.makeMobileModelUrl(ip, 1, version), {
            method: "POST",
            body: formData,
        });
        return await this.handleError(result);
    }

    // 获取主机上已上传的自定义机型文件列表
    public async getMobileModelUploadList(ip: string, version: "v2" | "v3"): Promise<MobileModelFile[]> {
        const result = await fetch(this.makeMobileModelUrl(ip, 0, version), {
            method: "POST",
        });
        return await this.handleError(result);
    }

    // 删除主机上已上传的自定义机型文件
    public async deleteMobileModel(ip: string, version: "v2" | "v3", path: string): Promise<MobileModelFile[] | string> {
        const result = await fetch(this.makeMobileModelUrl(ip, 2, version, path), {
            method: "POST",
        });
        return await this.handleError(result);
    }

    // 导出容器机型文件，返回机型文件在主机上的绝对路径
    public async exportMobileModelFile(ip: string, name: string, exportRandomData: boolean): Promise<string> {
        const result = await fetch(makeVmApiUrl("dc_api/export_mobile_model", ip, name) + `?export_random_data=${exportRandomData}&async=false`);
        return await this.handleError(result);
    }

    // 导入机型文件到容器，成功返回 'ok'
    public async importMobileModelFile(ip: string, name: string, file: File): Promise<string> {
        const formData = new FormData();
        formData.append("file", file);
        const result = await fetch(makeVmApiUrl("dc_api/import_mobile_model", ip, name) + `?async=false`, {
            method: "POST",
            body: formData,
        });
        return await this.handleError(result);
    }

    public async upload(ip: string, name: string, remotePath: string, file: File) {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('path', remotePath);
        formData.append('names', name);
        const result = await fetch(makeVmApiUrl("and_api/upload_file", ip), {
            method: "POST",
            body: formData,
        });
        return await this.handleError(result);
    }

    public async uploadMacvlan(android_sdk: string, remotePath: string, file: File) {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('path', remotePath);
        const result = await fetch(makeMacvlanVmApiUrl("and_api/upload_file", android_sdk), {
            method: "POST",
            body: formData,
        });
        return await this.handleError(result);
    }

    public async uploadToDocker(ip: string, names: string, remotePath: string, file: File, progress: (progressEvent: AxiosProgressEvent) => void) {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('names', names);
        formData.append('path', remotePath);
        const result = await axios({
            url: makeVmApiUrl("and_api/upload_file", ip).toString(), //+
            method: "POST",
            data: formData,
            onUploadProgress: progressEvent => {
                progress(progressEvent);
                // this.progressPercent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            }
        });
        return await this.handleAxiosError(result);
    }

    public async uploadToDockerMacvlan(android_sdk: string, remotePath: string, file: File, progress: (progressEvent: AxiosProgressEvent) => void) {
        return await this.handleAxiosError(await this.uploadToDockerMacvlanWithoutHandlerError(android_sdk, remotePath, file, progress));
    }

    public async uploadToDockerMacvlanWithoutHandlerError(android_sdk: string, remotePath: string, file: File, progress: (progressEvent: AxiosProgressEvent) => void) {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('path', remotePath);

        return await axios({
            url: makeMacvlanVmApiUrl("and_api/upload_file", android_sdk).toString(), //+
            method: "POST",
            data: formData,
            onUploadProgress: progressEvent => {
                progress(progressEvent);
                // this.progressPercent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            }
        });
    }

    public async batchCreate(hostIp: string, num: number, pre_name: string, param: CreateParam): Promise<BatchCreateResponse> {
        var formData = qs.stringify(param);
        const result = await fetch(makeVmApiUrl("dc_api/batch_create", hostIp, num.toString(), pre_name), {
            method: "POST",
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        const text = await result.text();
        try {
            const json = JSON.parse(text) as BatchCreateResponse;
            if (json.code !== 200) {
                throw new Error((json as any).err ?? text ?? "unknown error");
            }
            return json;
        } catch (e: any) {
            throw new Error(e.message ?? text ?? "unknown error");
        }
    }

    public async reboot(ip: string, name: string): Promise<string | undefined> {
        const result = await fetch(makeVmApiUrl("dc_api/reboot", ip, name));
        const j = await result.json();
        if (j.code == 4) {
            return j.err;
        } else if (j.code == 200) {
            return;
        } else {
            throw j.err;
        }
    }

    public async download(ip: string, name: string, path: string, localPath: string) {
        const result = await fetch(makeVmApiUrl("and_api/down_file", ip, name) + `?path=${path}&local=${localPath}`);
        return result.blob();
    }

    public async getDeviceListByHost(hi: HostInfo): Promise<DeviceInfo[]> {
        if (!hi.device_id || hi.device_id.trim() === "") {
            throw new Error(`Host ${hi.address} has no device_id`);
        }
        return this.getDeviceListByIp(hi.address, hi.device_id);
    }

    public async getGarbageFiles(ip: string): Promise<string[]> {
        const result = await fetch(makeVmApiUrl("dc_api/get_garbage_files", ip));
        return await this.handleError(result);
    }

    public async clearGarbageFiles(ip: string, req: ClearGarbageReq) {
        const result = await fetch(
            makeVmApiUrl("dc_api/clear_garbage_files", ip),
            {
                method: "POST",
                body: qs.stringify(req, { arrayFormat: "repeat" }),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );

        return await this.handleError(result);
    }


    public async getDeviceListByIp(hostIp: string, hostId: string): Promise<DeviceInfo[]> {
        const url = makeVmApiUrl("dc_api/get", hostIp);
        const result = await axios.get(url.toString(), { timeout: 10000 });
        var re = await this.handleAxiosError(result);
        (re ?? []).forEach(t => {
            t.hostIp = hostIp;
            t.hostId = hostId;
            t.key = `${hostIp}-${t.index}-${t.name}`;
            try {
                t.create_req = JSON.parse(t.create_req) as DeviceDetail;
            } catch (ex) {
                console.log(ex);
            }
        });
        //console.log(re)
        return re;
    }

    public async getImages(ip: string): Promise<ImageInfo[]> {
        const result = await fetch(makeVmApiUrl("image_api/get", ip));
        return await this.handleError(result);
    }

    public async getHostRemark(ip: string): Promise<string> {
        const result = await fetch(makeHostVmApiUrl("entry/get_remark", ip));
        return await this.handleError(result);
    }

    public async getSDKImages(ip: string): Promise<SDKImagesRes> {
        const result = await fetch(makeVmApiUrl("super_sdk_api/get", ip));
        return await this.handleError(result);
    }

    public async getDockerRegistries(ip: string): Promise<string> {
        const result = await fetch(makeVmApiUrl("/host/device/get_docker_registry", ip));
        return await this.handleError(result);
    }

    public async getDisks(ip: string): Promise<DiskListInfo> {
        const result = await fetch(makeHostVmApiUrl("entry/get_disk", ip));
        return await this.handleError(result);
    }

    public async getNvmeInfo(ip: string): Promise<NvmeInfo> {
        const result = await fetch(makeHostVmApiUrl("entry/nvme_info", ip));
        return await this.handleError(result);
    }

    public async setSwap(ip: string, act: number = 0, size: string = "0"): Promise<SwapInfo> {
        const result = await fetch(makeHostVmApiUrl("entry/swap", ip) + `?act=${act}&size=${size}`);
        return await this.handleError(result);
    }

    public async switchSDKImages(ip: string, addr: string): Promise<ImageInfo[]> {
        const result = await fetch(makeVmApiUrl("super_sdk_api/switch_version", ip) + `?address=${addr}`);
        return await this.handleError(result);
    }


    // pullImages 通过 SSE（image_api/pull_sse）而不是一次性阻塞请求来拉取/下载镜像：
    // 拉取一个官方仓库/Registry 地址通常很快，但该接口还支持传入任意 http(s) 地址直接下载
    // tar 包，慢速外部服务器可能耗时数分钟，普通阻塞请求会被网关/反代的空闲超时掐断，浏览器
    // 会把这类超时误报成 CORS 错误。SSE 连接本身持续有字节流出不会触发这个问题，还能顺带把
    // 后端实时测得的下载/导入进度推给前端，不需要客户端轮询。
    public pullImages(
        ip: string,
        addr: string,
        repository: string | undefined,
        onProgress?: (percent: number, status: string) => void
    ): { promise: Promise<any>, cancel: () => void; } {
        const url = new URL(makeVmApiUrl("image_api/pull_sse", ip).toString());
        url.searchParams.set("address", addr);
        if (repository) url.searchParams.set("repository", repository);

        const source = new EventSource(url.toString());
        let settled = false;
        let rejectFn: (reason?: any) => void = () => { };
        const promise = new Promise<any>((resolve, reject) => {
            rejectFn = reject;
            source.onmessage = (event) => {
                let msg: any;
                try {
                    msg = JSON.parse(event.data);
                } catch {
                    return;
                }

                if (msg.code === 3) {
                    // 进行中：{percent, status}，percent<0 表示无法计算具体百分比
                    if (onProgress && msg.data) onProgress(msg.data.percent, msg.data.status);
                    return;
                }

                settled = true;
                source.close();
                if (msg.code === 200) {
                    resolve(msg.data);
                } else {
                    reject(new Error(msg.err || "拉取失败"));
                }
            };
            source.onerror = () => {
                source.close();
                if (settled) return;
                settled = true;
                reject(new Error("与后端的连接中断"));
            };
        });

        // 关闭 EventSource 会让浏览器断开底层连接，后端 PullSSE 用 c.Request().Context()
        // 检测到客户端断开后会中止正在进行的下载/导入，不会有镜像残留；这里额外把 promise
        // 结束掉（用与 XHR 上传取消一致的 "aborted" 惯例），避免 onConfirm 里的 await 挂起。
        const cancel = () => {
            if (settled) return;
            settled = true;
            source.close();
            rejectFn("aborted");
        };

        return { promise, cancel };
    }

    // uploadImageFile 只负责把文件传到服务端落盘，不等解压/解析——那部分可能要花不少时间
    // （尤其大体积的 gz/xz 归档），挪到 loadImageSSE 里用 SSE 边处理边推进度。这里拿到的
    // token 就是 loadImageSSE 用来找回这个已落盘文件的凭证。
    public uploadImageFile(
        ip: string,
        file: File,
        onProgress?: (percent: number) => void
    ): { promise: Promise<{ token: string; }>, cancel: () => void; } {
        const xhr = new XMLHttpRequest();
        const promise = new Promise<any>((resolve, reject) => {
            xhr.open("POST", makeVmApiUrl("image_api/upload", ip), true);
            xhr.upload.onprogress = event => {
                if (onProgress && event.lengthComputable) {
                    onProgress(Math.round(event.loaded / event.total * 100));
                }
            };
            xhr.onload = () => {
                try {
                    const json = JSON.parse(xhr.responseText);
                    if (xhr.status >= 200 && xhr.status < 300 && json.code === 200) {
                        resolve(json.data);
                    } else {
                        reject(new Error(json.err || `Upload failed: ${xhr.status} ${xhr.statusText}`));
                    }
                } catch {
                    reject(new Error(`Invalid response: ${xhr.status} ${xhr.statusText}`));
                }
            };
            xhr.onerror = () => reject(new Error("Network error during image upload"));
            xhr.onabort = () => reject("aborted");

            const formData = new FormData();
            formData.append("file", file);
            xhr.send(formData);
        });

        return { promise, cancel: () => xhr.abort() };
    }

    // loadImageSSE 接着 uploadImageFile 的 token 继续：解压+扫描 tag、冲突检测，无冲突时直接
    // 导入 docker，全程通过 SSE 推真实字节进度，写法照抄 pullImages 的 EventSource 实现
    // （同样的 {code:3,data:{percent,status}} 进行中 / {code:200,data} 终态约定）。返回
    // {status:"loaded"} 表示已导入完成；{status:"need_confirm",conflicts,token} 表示会覆盖
    // 已有镜像，需调用 confirmLoadDockerImage/cancelLoadDockerImage 之一来完成或放弃。
    public loadImageSSE(
        ip: string,
        token: string,
        repository: string,
        onProgress?: (percent: number, status: string) => void
    ): { promise: Promise<{ status: "loaded"; } | { status: "need_confirm"; conflicts: string[]; token: string; }>, cancel: () => void; } {
        const url = new URL(makeVmApiUrl("image_api/load_sse", ip).toString());
        url.searchParams.set("token", token);
        if (repository) url.searchParams.set("repository", repository);

        const source = new EventSource(url.toString());
        let settled = false;
        let rejectFn: (reason?: any) => void = () => { };
        const promise = new Promise<any>((resolve, reject) => {
            rejectFn = reject;
            source.onmessage = (event) => {
                let msg: any;
                try {
                    msg = JSON.parse(event.data);
                } catch {
                    return;
                }

                if (msg.code === 3) {
                    if (onProgress && msg.data) onProgress(msg.data.percent, msg.data.status);
                    return;
                }

                settled = true;
                source.close();
                if (msg.code === 200) {
                    resolve(msg.data);
                } else {
                    reject(new Error(msg.err || "导入失败"));
                }
            };
            source.onerror = () => {
                source.close();
                if (settled) return;
                settled = true;
                reject(new Error("与后端的连接中断"));
            };
        });

        const cancel = () => {
            if (settled) return;
            settled = true;
            source.close();
            rejectFn("aborted");
        };

        return { promise, cancel };
    }

    // exportImageArchiveSSE 用于压缩格式（tar.gz）的镜像导出：压缩在服务端完成，通过 SSE 持续
    // 推送压缩进度（写法照抄 pullImages/loadImageSSE 的 EventSource 实现），压缩完成后终态事件
    // 携带一次性 token，前端再用该 token 拼出 export_archive_download 的 URL 触发浏览器下载。
    // 未压缩的 tar 格式不走这个接口，直接用 export_archive 一次性下载即可（无需进度反馈）。
    public exportImageArchiveSSE(
        ip: string,
        imageName: string,
        format: "gz",
        onProgress?: (percent: number, status: string) => void
    ): { promise: Promise<{ token: string; filename: string; }>, cancel: () => void; } {
        const url = new URL(makeVmApiUrl("image_api/export_archive_sse", ip).toString());
        url.searchParams.set("image_name", imageName);
        url.searchParams.set("format", format);

        const source = new EventSource(url.toString());
        let settled = false;
        let rejectFn: (reason?: any) => void = () => { };
        const promise = new Promise<any>((resolve, reject) => {
            rejectFn = reject;
            source.onmessage = (event) => {
                let msg: any;
                try {
                    msg = JSON.parse(event.data);
                } catch {
                    return;
                }

                if (msg.code === 3) {
                    if (onProgress && msg.data) onProgress(msg.data.percent, msg.data.status);
                    return;
                }

                settled = true;
                source.close();
                if (msg.code === 200) {
                    resolve(msg.data);
                } else {
                    reject(new Error(msg.err || "导出失败"));
                }
            };
            source.onerror = () => {
                source.close();
                if (settled) return;
                settled = true;
                reject(new Error("与后端的连接中断"));
            };
        });

        const cancel = () => {
            if (settled) return;
            settled = true;
            source.close();
            rejectFn("aborted");
        };

        return { promise, cancel };
    }

    public exportImageArchiveDownloadUrl(ip: string, token: string): string {
        const url = makeVmApiUrl("image_api/export_archive_download", ip);
        url.searchParams.set("token", token);
        return url.toString();
    }

    public async confirmLoadDockerImage(ip: string, token: string): Promise<void> {
        const result = await fetch(makeVmApiUrl("image_api/load_confirm", ip), {
            method: "POST",
            body: qs.stringify({ token }),
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        await this.handleError(result);
    }

    public async cancelLoadDockerImage(ip: string, token: string): Promise<void> {
        const result = await fetch(makeVmApiUrl("image_api/load_confirm", ip), {
            method: "POST",
            body: qs.stringify({ token, cancel: "true" }),
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        await this.handleError(result);
    }

    /**
     * 拉取镜像并回调进度。
     *
     * 服务端 image_api/pull_progress 的响应体是「进度字节(0x00/0x01) + 末尾一个 JSON 报文」，
     * 失败时（例如自定义镜像地址根本不存在）同样返回 HTTP 200，只是末尾 JSON 的 code != 200。
     * 所以不能只凭 onload 就当作成功，必须把尾部的 JSON 解析出来判断，否则调用方会以为镜像已经
     * 拉好而继续往下创建云机。
     *
     * `signal` 用于中途取消：镜像地址不存在或仓库不可达时 docker pull 可能长时间没有响应，
     * 界面需要能把这个请求断掉。
     */
    public async pullImageProgress(ip: string, addr: string, dockerRegistry: string, progressCb: (progress: number) => void, signal?: AbortSignal) {
        return new Promise<void>((resolve, reject) => {
            if (signal?.aborted) {
                reject(new PullImageAbortError());
                return;
            }
            const xhr = new XMLHttpRequest();
            const TOTAL_BYTES = 10_000; // 服务端固定推送字节数

            // 拼 URL
            const url = new URL(makeVmApiUrl("image_api/pull_progress", ip).toString());
            url.searchParams.set("address", addr);
            url.searchParams.set("registry_ip", dockerRegistry);

            // 进度事件
            xhr.onprogress = (event) => {
                if (event.lengthComputable) {
                    // 如果服务端有 Content-Length，可直接用 event.total
                    const pct = Math.min((event.loaded / event.total) * 100, 100);
                    progressCb(pct);
                } else {
                    // 如果没有 Content-Length，就用固定的 TOTAL_BYTES
                    const pct = Math.min((event.loaded / TOTAL_BYTES) * 100, 100);
                    progressCb(pct);
                }
            };

            xhr.onload = () => {
                if (xhr.status < 200 || xhr.status >= 300) {
                    reject(new Error(`下载失败: ${xhr.status} ${xhr.statusText}`));
                    return;
                }
                const msg = parsePullProgressResult(xhr.response);
                if (msg && msg.code !== 200) {
                    reject(new Error(msg.err || `下载失败: ${addr}`));
                    return;
                }
                progressCb(100);
                resolve();
            };

            xhr.onerror = () => {
                reject(new Error(`下载失败: ${xhr.status} ${xhr.statusText}`));
            };

            xhr.onabort = () => {
                reject(new PullImageAbortError());
            };

            signal?.addEventListener("abort", () => xhr.abort(), { once: true });

            // 打开连接
            xhr.open("GET", url.toString(), true);
            // 二进制模式，这里不解析成字符串
            xhr.responseType = "arraybuffer";

            // 发送请求
            xhr.send();
        });
    }


    public async getFilelist(ip: string, name: string, path: string): Promise<FilelistInfo[]> {
        const result = await fetch(makeVmApiUrl("and_api/get_file_list", ip, name) + `?path=${path}`);
        return await this.handleError(result);
    }

    public async getFilelistMacvlan(android_sdk: string, path: string): Promise<FilelistInfo[]> {
        const result = await fetch(makeMacvlanVmApiUrl("and_api/get_file_list", android_sdk) + `?path=${path}`);
        return await this.handleError(result);
    }

    public async screenMirrorRun(android_sdk: string, act: number): Promise<string> {
        const result = await fetch(makeMacvlanVmApiUrl("and_api/screen_mirror_run", android_sdk) + `?act=${act}`);
        return await this.handleError(result);
    }

    public async screenMirrorId(android_sdk: string, act: number): Promise<string> {
        const result = await fetch(makeMacvlanVmApiUrl("and_api/screen_mirror_id", android_sdk) + `?act=${act}`);
        return await this.handleError(result);
    }

    // 查询摇一摇时间因子（0 表示关闭，范围 0-300）
    public async getShake(android_sdk: string): Promise<number> {
        const result = await fetch(makeMacvlanVmApiUrl("and_api/set_shake", android_sdk) + `?act=0`);
        return await this.handleError(result);
    }

    // 设置摇一摇时间因子，返回设置后的值
    public async setShake(android_sdk: string, count: number): Promise<number> {
        const result = await fetch(makeMacvlanVmApiUrl("and_api/set_shake", android_sdk) + `?act=1&count=${count}`);
        return await this.handleError(result);
    }

    public async getHosts(): Promise<HostInfo[]> {
        const result = await fetch(makeHostVmApiUrl("entry/get", Config.host));
        const hosts: HostInfo[] = await this.handleError(result);

        // 并发补齐 deviceId
        await Promise.all(
            hosts.map(async (host) => {
                if (!host.device_id || host.device_id.trim() === "") {
                    try {
                        const detail = await this.getDeviceId(host.address);
                        if (detail) {
                            host.device_id = detail;
                        }
                    } catch (e) {
                        console.warn(
                            `Failed to fetch deviceId for host ${host.address}`,
                            e
                        );
                    }
                }
            })
        );

        return hosts;
    }

    public async getDeviceId(ip: string, timeout: number = 200): Promise<string> {
        const url = makeHostVmApiUrl("entry/get_device_id", ip).toString();
        const result = await axios.get(url, { timeout });
        return await this.handleAxiosError(result);
    }

    public async setDiscover(ip: string, act: number = 0, auto: boolean = true, host_ips: string = ""): Promise<DiscoverInfo> {
        const result = await fetch(makeHostVmApiUrl("entry/set_discover", ip) + `?act=${act}&auto=${auto}&host_ips=${host_ips}`);
        return await this.handleError(result);
    }

    public async rebootHost(ip: string) {
        const result = await fetch(makeHostVmApiUrl("entry/reboot", ip));
        return await this.handleError(result);
    }

    public async shutdownHost(ip: string) {
        const result = await fetch(makeHostVmApiUrl("entry/shutdown", ip));
        return await this.handleError(result);
    }

    public async checkFirmware(ip: string): Promise<boolean> {
        const result = await fetch(makeHostVmApiUrl("entry/check_firmware", ip));
        return await this.handleError(result);
    }

    public async updateFirmware(ip: string) {
        const result = await fetch(makeHostVmApiUrl("entry/update_firmware", ip));
        return await this.handleError(result);
    }

    public async formatDisk(ip: string) {
        const result = await fetch(makeHostVmApiUrl("entry/format_disk", ip));
        return await this.handleError(result);
    }

    public async switchDisk(
        ip: string,
        disk: string,
        iscsiInfo?: IscsiInfo
    ) {
        const params = new URLSearchParams({
            disk,
        });

        if (iscsiInfo) {
            params.append("iscsi_ip", iscsiInfo.ip);
            params.append("iscsi_port", String(iscsiInfo.port));
            params.append("iscsi_target", iscsiInfo.target);
            params.append("iscsi_lun", String(iscsiInfo.lun));

            // 下面两个可选，看你后端是否需要
            params.append("iscsi_username", iscsiInfo.username ?? "");
            params.append("iscsi_password", iscsiInfo.password ?? "");
        }

        const url =
            makeHostVmApiUrl("entry/switch_disk", ip) +
            "?" +
            params.toString();

        const result = await fetch(url);
        return await this.handleError(result);
    }


    public async pruneImages(ip: string) {
        const result = await fetch(makeVmApiUrl("dc_api/prune_images", ip));
        return await this.handleError(result);
    }

    public async getDockerImagesWithUsage(ip: string): Promise<DockerImageUsageInfo[]> {
        const result = await fetch(makeVmApiUrl("image_api/list_with_usage", ip));
        return await this.handleError(result);
    }

    /** 返回删除失败的镜像ID到失败原因的映射；未出现在结果中的ID视为删除成功，全部成功时返回空对象 */
    public async deleteDockerImages(ip: string, ids: string[]): Promise<Record<string, string>> {
        const result = await fetch(
            makeVmApiUrl("image_api/remove", ip),
            {
                method: "POST",
                body: qs.stringify({ ids }, { arrayFormat: "repeat" }),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );
        return await this.handleError(result);
    }

    public async resetHost(ip: string) {
        const result = await fetch(makeHostVmApiUrl("entry/reset", ip));
        return await this.handleError(result);
    }

    // ---- 启动项（host_server 托管的外部程序，端口82）----
    // 列表/启停/重启/编辑/批量删除/查日志全部合并进一条 GET，用 act 区分（对齐 host_server
    // 侧 startupHandler.Act 的 0~6），跟机型文件接口的 makeMobileModelUrl 是同一个套路；
    // 新增（要带文件）和日志 SSE（长连接）GET 扛不住，各自单独留一个接口。

    private makeStartupActUrl(ip: string, act: 0 | 1 | 2 | 3 | 4 | 5 | 6) {
        const url = makeHostVmApiUrl("startup", ip);
        url.searchParams.set("act", act.toString());
        return url;
    }

    public async getStartups(ip: string): Promise<StartupInfo[]> {
        const result = await fetch(this.makeStartupActUrl(ip, 0));
        return (await this.handleError(result)) ?? [];
    }

    /**
     * 探测目标主机的 host_server 是否已经升级到支持启动项管理——老版本 host_server 没有
     * /startup/* 路由，请求会落到 echo 的默认 404，而不是走到 handler 返回业务错误。
     * 用于 GUI 侧决定要不要展示"打开启动项管理"的入口按钮，避免用户点进去才发现接口不存在。
     */
    public async isStartupSupported(ip: string): Promise<boolean> {
        try {
            const result = await fetch(this.makeStartupActUrl(ip, 0));
            return result.status !== 404;
        } catch {
            return false;
        }
    }

    /**
     * 上传可执行文件并新建启动项。用 XMLHttpRequest 而不是 fetch 是为了拿上传进度：
     * 可执行文件最大允许 200MB，走慢速网络时没有进度条会让人以为卡死了。
     */
    public addStartup(
        ip: string,
        params: { name: string; file: File; command?: string; restartPolicy?: StartupRestartPolicy; start?: boolean; },
        onProgress?: (percent: number) => void
    ): { promise: Promise<StartupInfo>, cancel: () => void; } {
        const xhr = new XMLHttpRequest();
        const promise = new Promise<StartupInfo>((resolve, reject) => {
            xhr.open("POST", makeHostVmApiUrl("startup/add", ip).toString(), true);
            xhr.upload.onprogress = event => {
                if (onProgress && event.lengthComputable) {
                    onProgress(Math.round(event.loaded / event.total * 100));
                }
            };
            xhr.onload = () => {
                try {
                    const json = JSON.parse(xhr.responseText);
                    if (xhr.status >= 200 && xhr.status < 300 && json.code === 200) {
                        resolve(json.data);
                    } else {
                        reject(new Error(json.err || `Upload failed: ${xhr.status} ${xhr.statusText}`));
                    }
                } catch {
                    reject(new Error(`Invalid response: ${xhr.status} ${xhr.statusText}`));
                }
            };
            xhr.onerror = () => reject(new Error("Network error during startup upload"));
            xhr.onabort = () => reject("aborted");

            const formData = new FormData();
            formData.append("name", params.name);
            formData.append("file", params.file);
            formData.append("command", params.command ?? "");
            formData.append("restart_policy", params.restartPolicy ?? "");
            formData.append("start", params.start ? "1" : "0");
            xhr.send(formData);
        });

        return { promise, cancel: () => xhr.abort() };
    }

    /** 修改名称、启动命令与退出后处理策略；命令的改动要重启该启动项才会生效 */
    public async updateStartup(ip: string, id: number, name: string, command: string, restartPolicy: StartupRestartPolicy) {
        const url = this.makeStartupActUrl(ip, 4);
        url.searchParams.set("id", id.toString());
        url.searchParams.set("name", name);
        url.searchParams.set("command", command);
        url.searchParams.set("restart_policy", restartPolicy);
        const result = await fetch(url);
        return await this.handleError(result);
    }

    public async startStartup(ip: string, id: number) {
        const url = this.makeStartupActUrl(ip, 1);
        url.searchParams.set("id", id.toString());
        const result = await fetch(url);
        return await this.handleError(result);
    }

    public async stopStartup(ip: string, id: number) {
        const url = this.makeStartupActUrl(ip, 2);
        url.searchParams.set("id", id.toString());
        const result = await fetch(url);
        return await this.handleError(result);
    }

    public async restartStartup(ip: string, id: number) {
        const url = this.makeStartupActUrl(ip, 3);
        url.searchParams.set("id", id.toString());
        const result = await fetch(url);
        return await this.handleError(result);
    }

    /** 返回删除失败的启动项ID到失败原因的映射；全部成功时返回空对象 */
    public async deleteStartups(ip: string, ids: number[]): Promise<Record<string, string>> {
        const url = this.makeStartupActUrl(ip, 5);
        for (const id of ids) url.searchParams.append("ids", id.toString());
        const result = await fetch(url);
        return (await this.handleError(result)) ?? {};
    }

    /** 返回日志末尾的内容（默认后端截 256KB），不是完整日志 */
    public async getStartupLogs(ip: string, id: number): Promise<string> {
        const url = this.makeStartupActUrl(ip, 6);
        url.searchParams.set("id", id.toString());
        const result = await fetch(url);
        return (await this.handleError(result)) ?? "";
    }

    /**
     * 通过 SSE 持续订阅启动项日志：连接建立时先推一次现有尾部内容（{init:true}，用来替换），
     * 之后每有新增内容就推一次增量（{init:false}，用来追加），没有新内容的 tick 后端不会推送。
     * 断线由 EventSource 按规范自动重连，onStatusChange 只是把连接状态暴露出来给界面显示。
     */
    public subscribeStartupLogs(
        ip: string,
        id: number,
        onEvent: (e: { init: boolean; text: string; }) => void,
        onStatusChange?: (connected: boolean) => void,
    ): () => void {
        const url = makeHostVmApiUrl("startup/logs_sse", ip) + `?id=${id}`;
        const source = new EventSource(url);

        source.onopen = () => onStatusChange?.(true);
        source.onerror = () => onStatusChange?.(false);

        source.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.code !== 200) {
                    throw new Error(msg.err ?? "unknown error");
                }
                onEvent(msg.data);
            } catch (e) {
                console.warn(e);
            }
        };

        return () => source.close();
    }

    public async getHostDetail(ip: string): Promise<HostDetailInfo> {
        const result = await fetch(makeHostVmApiUrl("entry/system_info", ip));
        return await this.handleError(result);
    }

    /**
     * 通过 SSE 持续订阅主机系统信息，避免客户端轮询。
     * 返回取消订阅函数，调用后关闭底层 EventSource 连接。
     */
    public subscribeHostDetail(
        ip: string,
        onData: (detail: HostDetailInfo) => void,
        onError?: (e: any) => void,
    ): () => void {
        const url = makeHostVmApiUrl("entry/system_info_sse", ip);
        const source = new EventSource(url);

        source.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.code !== 200) {
                    throw new Error(msg.err ?? "unknown error");
                }
                onData(msg.data as HostDetailInfo);
            } catch (e) {
                console.warn(e);
                onError?.(e);
            }
        };

        source.onerror = (e) => {
            onError?.(e);
        };

        return () => source.close();
    }

    public async getWarehousingInfo(ip: string): Promise<any> {
        const result = await fetch(makeHostVmApiUrl("entry/warehousing/get", ip));
        return await result.json();
    }

    public async changeModel(ip: string, name: string, model_id: number): Promise<void> {
        const result = await fetch(makeVmApiUrl("and_api/random_devinfo", ip, name) + `?modelid=${model_id}`);
        return await this.handleError(result);
    }

    public async changeModelMacvlan(android_sdk: string, model_id: number, source: string = ""): Promise<void> {
        let url = makeMacvlanVmApiUrl("and_api/random_devinfo", android_sdk) + `?modelid=${model_id}`;
        if (source) url += `&mobile_model_source=${encodeURIComponent(source)}`;
        const result = await fetch(url);
        return await this.handleError(result);
    }

    public async reset(ip: string, name: string): Promise<string | undefined> {
        const result = await fetch(makeVmApiUrl("dc_api/reset", ip, name));
        const j = await result.json();
        if (j.code == 4) {
            return j.err;
        } else if (j.code == 200) {
            return;
        } else {
            throw j.err;
        }
    }

    public async rename(ip: string, name: string, newName: string): Promise<void> {
        const result = await fetch(makeVmApiUrl("dc_api/rename", ip, name, newName));
        return await this.handleError(result);
    }

    public async setHostRemark(ip: string, name: string): Promise<void> {
        const result = await fetch(makeVmApiUrl("/host/device/set_remark", ip) + `?name=${name}`);
        return await this.handleError(result);
    }


    public async shutdown(ip: string, name: string): Promise<void> {
        const result = await fetch(makeVmApiUrl("dc_api/stop", ip, name));
        return await this.handleError(result);
    }

    public async start(ip: string, name: string): Promise<string | undefined> {
        const result = await fetch(makeVmApiUrl("dc_api/run", ip, name));
        const j = await result.json();
        if (j.code == 4) {
            return j.err;
        } else if (j.code == 200) {
            return;
        } else if (j.code == 1 && typeof j.err === "string" && j.err.includes("VIP")) {
            // VIP镜像受限，引导去开通VIP；其它 code==1 错误（如实例位过期/未续费）按普通错误抛出
            throw new VipImageRestrictedError(j.err);
        } else {
            throw j.err;
        }
    }

    public async delete(ip: string, name: string): Promise<void> {
        const result = await fetch(makeVmApiUrl("dc_api/remove", ip, name));
        return await this.handleError(result);
    }

    public async screenshot(ip: string, name: string, level: number = 1): Promise<Blob> {
        const result = await fetch(makeVmApiUrl("and_api/screenshots", ip, name, level.toString()));
        return result.blob();
    }

    public async screenshotMacvlan(android_sdk: string, level: number = 1): Promise<Blob> {
        const result = await fetch(makeMacvlanVmApiUrl("and_api/screenshots", android_sdk) + `?level=${level.toString()}`);
        return result.blob();
    }

    public async create(param: DockerEditParam): Promise<void> {
        var formData = qs.stringify(param.obj);
        const result = await fetch(makeVmApiUrl("dc_api/create", param.info.hostIp, param.obj.index!.toString(), param.obj.name), {
            method: "POST",
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return await this.handleError(result);
    }

    public async update(param: DockerEditParam): Promise<void> {
        var formData = qs.stringify(param.obj);
        const result = await fetch(makeVmApiUrl("dc_api/update", param.info.hostIp, param.info.name), {
            method: "POST",
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return await this.handleError(result);
    }

    public async s5set(ip: string, name: string, param: S5setParam): Promise<void> {
        var formData = qs.stringify(param);
        const result = await fetch(makeVmApiUrl("and_api/proxy_set", ip, name), {
            method: "POST",
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
        });
        return await this.handleError(result);
    }

    public async s5setMacvlan(android_sdk: string, param: S5setParam): Promise<void> {
        var formData = qs.stringify(param);
        const result = await fetch(makeMacvlanVmApiUrl("and_api/proxy_set", android_sdk) + `?${formData}`);
        return await this.handleError(result);
    }

    public async closeS5(ip: string, name: string): Promise<void> {
        const result = await fetch(makeVmApiUrl("and_api/proxy_stop", ip, name));
        return await this.handleError(result);
    }

    public async closeS5Macvlan(android_sdk: string): Promise<void> {
        const result = await fetch(makeMacvlanVmApiUrl("and_api/proxy_stop", android_sdk));
        return await this.handleError(result);
    }

    public async checkS5(ip: string, s5Param: S5setParam, check_url: string): Promise<string> {
        const query = Object.assign({}, s5Param, { check_url });
        const result = await fetch(makeVmApiUrl("and_api/proxy_check", ip) + `?${qs.stringify(query)}`);
        return await this.handleError(result);
    }

    public async checkS5Macvlan(android_sdk: string, s5Param: S5setParam, check_url: string): Promise<string> {
        const query = Object.assign({}, s5Param, { check_url });
        const result = await fetch(makeMacvlanVmApiUrl("and_api/proxy_check", android_sdk) + `?${qs.stringify(query)}`);
        return await this.handleError(result);
    }

    public async getContainerGitCommitId(ip: string, name: string): Promise<string> {
        const result = await fetch(makeVmApiUrl("and_api/git", ip, name));
        return await this.handleError(result);
    }

    public async getContainerGitCommitIdMacvlan(android_sdk: string): Promise<string> {
        const result = await fetch(makeMacvlanVmApiUrl("and_api/git", android_sdk));
        return await this.handleError(result);
    }

    public async getFirmwareVersionList(): Promise<FirmwareVersionInfo[]> {
        const result = await fetch("https://download.hexdeep.com/hexos/3588-node/hot/cfg.txt");
        const json = await result.json();
        return json;
    }

    public async getCurrentFirmwareVersion(ip: string): Promise<string> {
        const result = await fetch(makeHostVmApiUrl("entry/switch_firmware", ip) + `?act=0`);
        return await this.handleError(result);
    }

    public async switchFirmwareVersion(ip: string, version: string): Promise<void> {
        const result = await fetch(makeHostVmApiUrl("entry/switch_firmware", ip) + `?act=1&version=${version}`);
        return await this.handleError(result);
    }

    public uploadCustomFirmware(
        ip: string,
        file: File,
        progress: (progressEvent: ProgressEvent) => void
    ): { promise: Promise<any>, cancel: () => void; } {
        const xhr = new XMLHttpRequest();

        const promise = new Promise((resolve, reject) => {
            const url = makeHostVmApiUrl("entry/upload_firmware", ip);
            xhr.open("POST", url, true);

            xhr.upload.onprogress = progress;

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const json = JSON.parse(xhr.responseText);
                        if (json.code == 200) {
                            resolve(json.data);
                        } else {
                            reject(new Error(json.err));
                        }
                    } catch (e) {
                        reject(new Error("Invalid JSON response"));
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => reject(new Error("Network error during upload"));
            xhr.onabort = () => reject("aborted");

            const formData = new FormData();
            formData.append("file", file);

            xhr.send(formData);
        });

        const cancel = () => {
            xhr.abort();
        };

        return { promise, cancel };
    }

}

export const deviceApi = new DeviceApi();
