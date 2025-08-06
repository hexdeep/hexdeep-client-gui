
import { makeMacvlanApiUrl, makeVmApiUrl } from "@/common/common";
import { Config } from "@/common/Config";
import axios, { AxiosProgressEvent } from "axios";
import qs from 'qs';
import { ApiBase } from "./api_base";
import { CloneVmParam, CreateParam, DeviceDetail, DeviceInfo, DockerEditParam, FilelistInfo, HostDetailInfo, HostInfo, ImageInfo, S5setParam, SDKImagesRes } from "./device_define";

class DeviceApi extends ApiBase {
    private fileListInfo!: FilelistInfo;
    public async queryS5(hostIp: string, name: string) {
        const result = await fetch(makeVmApiUrl("and_api/s5_query", hostIp, name));
        let obj = await this.handleError(result);
        let re: S5setParam = { s5_domain_mode: obj.domain_mode };
        try {
            let url = new URL(obj.addr);
            return { s5_domain_mode: obj.domain_mode, s5_ip: url.hostname, s5_port: url.port, s5_user: url.username, s5_pwd: url.password };
        } catch (e) {
            console.warn(e);
        }
        return re;
    }

    public async cloneVm(hostIp: string, name: string, item: CloneVmParam) {
        const result = await fetch(makeVmApiUrl("dc_api/copy", hostIp, name, item.index.toString(), item.dst_name, item.remove.toString()));
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
        });
        //console.log("await all");
        await Promise.allSettled(tasks).catch(e => {
            console.log(e);
        });
        // console.log("all done");
        return result;
    }

    public async getModelList() {
        const result = await fetch("https://hexdeep.oss-cn-shanghai.aliyuncs.com/mobile_cfgs/cfg.txt");
        const json = await result.json();
        return json;
    }

    public async upload(ip: string, name: string, remotePath: string, file: File) {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('remote_path', remotePath);
        formData.append('names', name);
        const result = await fetch(makeVmApiUrl("and_api/upload_file", ip), {
            method: "POST",
            body: formData,
        });
        return await this.handleError(result);
    }

    public async uploadToDocker(ip: string, names: string, remotePath: string, file: File, progress: (progressEvent: AxiosProgressEvent) => void) {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('names', names);
        formData.append('remote_path', remotePath);
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

    public async reboot(ip: string, name: string) {
        const result = await fetch(makeVmApiUrl("dc_api/reboot", ip, name));
        return await this.handleError(result);
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
        const result = await axios.get(url.toString(), { timeout: 1000 });
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

    public async getSDKImages(ip: string): Promise<SDKImagesRes> {
        const result = await fetch(makeVmApiUrl("super_sdk_api/get", ip));
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

    public async getFilelist(ip: string, name: string, path: string): Promise<FilelistInfo[]> {
        const result = await fetch(makeVmApiUrl("and_api/get_file_list", ip, name) + `?path=${path}`);
        return await this.handleError(result);
    }

    public async getFilelistMacvlan(android_sdk: string, path: string): Promise<FilelistInfo[]> {
        const result = await fetch(makeMacvlanApiUrl("and_api/get_file_list", android_sdk) + `?path=${path}`);
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

    public async pruneImages(ip: string) {
        const result = await fetch(makeVmApiUrl("dc_api/prune_images", ip));
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

    public async reset(ip: string, name: string): Promise<void> {
        const result = await fetch(makeVmApiUrl("dc_api/reset", ip, name));
        return await this.handleError(result);
    }

    public async rename(ip: string, name: string, newName: string): Promise<void> {
        const result = await fetch(makeVmApiUrl("dc_api/rename", ip, name, newName));
        return await this.handleError(result);
    }

    public async shutdown(ip: string, name: string): Promise<void> {
        const result = await fetch(makeVmApiUrl("dc_api/stop", ip, name));
        return await this.handleError(result);
    }

    public async start(ip: string, name: string): Promise<void> {
        const result = await fetch(makeVmApiUrl("dc_api/run", ip, name));
        return await this.handleError(result);
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
        const result = await fetch(makeMacvlanApiUrl("and_api/screenshots", android_sdk) + `?level=${level.toString()}`);
        return result.blob();
    }

    public async create(param: DockerEditParam): Promise<void> {
        var formData = qs.stringify(param.obj);
        const result = await fetch(makeVmApiUrl("dc_api/create", param.info.hostIp, param.info.index.toString(), param.obj.name), {
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
        const result = await fetch(makeVmApiUrl("and_api/s5_set", ip, name) + `?${formData}`);
        return await this.handleError(result);
    }

    public async closeS5(ip: string, name: string): Promise<void> {
        const result = await fetch(makeVmApiUrl("and_api/s5_stop", ip, name));
        return await this.handleError(result);
    }

    public async checkS5(ip: string, s5Param: S5setParam, check_url: string): Promise<string> {
        const query = Object.assign({}, s5Param, { check_url });
        const result = await fetch(makeVmApiUrl("and_api/s5_check", ip) + `?${qs.stringify(query)}`);
        return await this.handleError(result);
    }

    public async getContainerGitCommitId(ip: string, name: string): Promise<string> {
        const result = await fetch(makeVmApiUrl("and_api/git", ip, name));
        return await this.handleError(result);
    }

    public async getContainerGitCommitIdMacvlan(android_sdk: string): Promise<string> {
        const result = await fetch(makeMacvlanApiUrl("and_api/git", android_sdk));
        return await this.handleError(result);
    }


}

export const deviceApi = new DeviceApi();
