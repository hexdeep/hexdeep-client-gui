
import { Config } from "@/common/Config";
import qs from 'qs';
import { CreateParam, DeviceInfo, DockerEditParam, FilelistInfo, HostDetailInfo, HostInfo, ImageInfo, S5setParam, SDKImageInfo, SDKImagesRes } from "./device_define";
import { ApiBase } from "./api_base";
import { makeVmApiUrl } from "@/common/common";
import { HostDetail } from "./order_define";

class DeviceApi extends ApiBase {

    public async rebootSDK(ip: string) {
        const result = await fetch(makeVmApiUrl("super_sdk_api/restart", ip));
        return await this.handleError(result);
    }

    public async getAllDevices() {
        var result = await deviceApi.getHosts();
        var tasks: Promise<DeviceInfo[]>[] = [];
        result.forEach(element => {
            var t = this.getDeviceList(element.address);

            t.then(e => element.devices = (e ?? []).map(e => {
                e.hostIp = element.address;
                e.key = `${element.address}-${e.index}-${e.name}`;
                return e;
            })).catch(error => {
                console.log(error);
                element.has_error = true;
                element.devices = [];
            });
            tasks.push(t);
        });
        console.log("await all");
        await Promise.all(tasks).catch(e => {
            console.log(e);
        });
        console.log("all done");
        return result;
    }

    public async getModelList() {
        const result = await fetch("https://hexdeep.com/hot/hexdeep/mobile_cfgs/cfg.txt");
        const json = await result.json();
        return json;
    }

    public async upload(ip: string, name: string, remotePath: string, file: File) {
        var formData = new FormData();
        formData.append('file', file);
        const result = await fetch(makeVmApiUrl("and_api/upload_file", ip, name) + `?remote_path=${remotePath}`, {
            method: "POST",
            body: formData,
        });
        console.log(result);
        return await this.handleError(result);
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
        return await this.handleError(result);
    }

    public async getDeviceList(ip: string): Promise<DeviceInfo[]> {
        const result = await fetch(makeVmApiUrl("dc_api/get", ip));
        var re = await this.handleError(result);
        (re ?? []).forEach(t => {
            t.hostIp = ip;
            t.key = `${ip}-${t.index}-${t.name}`;
        });
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

    public async getHosts(): Promise<HostInfo[]> {
        const result = await fetch(makeVmApiUrl("host/device/get", Config.host));
        return await this.handleError(result);
    }

    public async getHostDetail(ip: string): Promise<HostDetailInfo> {

        const result = await fetch(makeVmApiUrl("host/device/system_info", ip));
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
}

export const deviceApi = new DeviceApi();
