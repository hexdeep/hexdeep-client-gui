
import { makeMacvlanVmApiUrl, makeVmApiUrl } from "@/common/common";
import { Config } from "@/common/Config";
import axios, { AxiosProgressEvent } from "axios";
import qs from 'qs';
import { ApiBase } from "./api_base";
import { CloneVmParam, CreateParam, DeviceDetail, DeviceInfo, DockerEditParam, FilelistInfo, HostDetailInfo, HostInfo, ImageInfo, S5setParam, SDKImagesRes, DiskListInfo } from "./device_define";
import { Completer } from "@/lib/completer";
import { decamelizeKeys } from 'humps';

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
        const result = await fetch(makeVmApiUrl("super_sdk_api/restart", ip));
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

    public async getModelList() {
        const result = await fetch("https://download.hexdeep.com/mobile_cfgs/cfg.txt");
        const json = await result.json();
        return json;
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

    public async batchCreate(hostIp: string, num: number, pre_name: string, param: CreateParam) {
        var formData = qs.stringify(param);
        const result = await fetch(makeVmApiUrl("dc_api/batch_create", hostIp, num.toString(), pre_name), {
            method: "POST",
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return await this.handleError(result);
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
        return this.getDeviceListByIp(hi.address, hi.device_id);
    }

    public async getDeviceListByIp(hostIp: string, hostId: string): Promise<DeviceInfo[]> {
        const url = makeVmApiUrl("dc_api/get", hostIp);
        const result = await axios.get(url.toString(), { timeout: 4000 });
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
        const result = await fetch(makeVmApiUrl("/host/device/get_remark", ip));
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
        const result = await fetch(makeVmApiUrl("/host/device/get_disk", ip));
        return await this.handleError(result);
    }

    public async switchSDKImages(ip: string, addr: string): Promise<ImageInfo[]> {
        const result = await fetch(makeVmApiUrl("super_sdk_api/switch_version", ip) + `?address=${addr}`);
        return await this.handleError(result);
    }


    public async pullImages(ip: string, addr: string) {
        const result = await fetch(makeVmApiUrl("image_api/pull", ip) + `?address=${addr}`);
        return await this.handleError(result);
    }

    public async pullImageProgress(ip: string, addr: string, dockerRegistry: string, progressCb: (progress: number) => void) {
        return new Promise<void>((resolve, reject) => {
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
                progressCb(100);
                resolve();
            };

            xhr.onerror = () => {
                reject(new Error(`下载失败: ${xhr.status} ${xhr.statusText}`));
            };

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

    public async getHosts(): Promise<HostInfo[]> {
        const result = await fetch(makeVmApiUrl("host/device/get", Config.host));
        return await this.handleError(result);
    }

    public async rebootHost(ip: string) {
        const result = await fetch(makeVmApiUrl("host/device/reboot", ip));
        return await this.handleError(result);
    }

    public async checkFirmware(ip: string): Promise<boolean> {
        const result = await fetch(makeVmApiUrl("host/device/check_firmware", ip));
        return await this.handleError(result);
    }

    public async updateFirmware(ip: string) {
        const result = await fetch(makeVmApiUrl("host/device/update_firmware", ip));
        return await this.handleError(result);
    }

    public async formatDisk(ip: string) {
        const result = await fetch(makeVmApiUrl("host/device/format_disk", ip));
        return await this.handleError(result);
    }

    public async switchDisk(ip: string, disk: string) {
        const result = await fetch(makeVmApiUrl("host/device/switch_disk", ip) + `?disk=${disk}`);
        return await this.handleError(result);
    }


    public async pruneImages(ip: string) {
        const result = await fetch(makeVmApiUrl("dc_api/prune_images", ip));
        return await this.handleError(result);
    }

    public async resetHost(ip: string) {
        const result = await fetch(makeVmApiUrl("host/device/reset", ip));
        return await this.handleError(result);
    }

    public async getHostDetail(ip: string): Promise<HostDetailInfo> {
        const result = await fetch(makeVmApiUrl("host/device/system_info", ip));
        return await this.handleError(result);
    }

    public async changeModel(ip: string, name: string, model_id: number): Promise<void> {
        const result = await fetch(makeVmApiUrl("and_api/random_devinfo", ip, name) + `?modelid=${model_id}`);
        return await this.handleError(result);
    }

    public async changeModelMacvlan(android_sdk: string, model_id: number): Promise<void> {
        const result = await fetch(makeMacvlanVmApiUrl("and_api/random_devinfo", android_sdk) + `?modelid=${model_id}`);
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


}

export const deviceApi = new DeviceApi();
