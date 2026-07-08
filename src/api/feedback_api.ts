import { HostInfo } from "@/api/device_define";
import { makeHostVmApiUrl, makeVmApiUrl } from "@/common/common";
import { Config } from "@/common/Config";
import { ApiBase } from "./api_base";
import { FeedbackSubmitParam } from "./feedback_define";

// 硬编码路径：host_server 部署在 /usr/bin/host_server，日志相对可执行文件目录；
// super_sdk 容器固定把日志写到挂载进容器的 /st/log/log.txt；
// docker.log 是宿主机 Docker 守护进程的日志，同样通过 host_server 的 entry/download 读取。
const HOST_SERVER_LOG_PATH = "/usr/bin/log/log.txt";
const SUPER_SDK_LOG_PATH = "/st/log/log.txt";
const DOCKER_LOG_PATH = "/var/log/docker.log";

// hexdeep_server 只在 https://api.hexdeep.com 上直接暴露裸路径（如 /feedback/add），
// 没有 "/server/" 前缀，http（非 tls）也不通（502）。makeVmApiUrl 是为按 IP 直连
// H1/H49 设备自身的 host_server/super_sdk 设计的，拼出来的 URL 对 hexdeep_server 无效，
// 因此这里改为直连真实后端域名。
const HEXDEEP_SERVER_BASE = "https://api.hexdeep.com";

class FeedbackApi extends ApiBase {
    /** 直接通过 /entry/get 获取主机列表，不做 device_id 回填 */
    public async getMachines(): Promise<HostInfo[]> {
        const result = await fetch(makeHostVmApiUrl("entry/get", Config.host));
        return await this.handleError(result) ?? [];
    }

    public async submit(param: FeedbackSubmitParam): Promise<void> {
        const formData = new FormData();
        formData.append("description", param.description);
        formData.append("machines", param.machines.map(m => m.device_id || m.address).join(","));
        formData.append("send_log", param.sendLog ? "1" : "0");
        param.files.forEach(file => formData.append("files", file));

        if (param.sendLog && param.machines.isNotEmpty) {
            await Promise.all(param.machines.map(host => this.appendHostLogs(formData, host)));
        }

        const result = await fetch(`${HEXDEEP_SERVER_BASE}/feedback/add`, {
            method: "POST",
            body: formData,
        });
        return await this.handleError(result);
    }

    /**
     * 采集单台机器的 host_server + super_sdk + docker 日志，失败互不影响，只打印告警。
     * 字段名即最终存储的文件名（不含扩展名），hexdeep_server 只负责补上 .log 后缀，
     * 不做任何改名/归类，因此这里必须已经是规范化好的名字。
     */
    private async appendHostLogs(formData: FormData, host: HostInfo) {
        const key = host.device_id || host.address;

        try {
            const blob = await this.downloadLogFile(makeHostVmApiUrl("entry/download", host.address), HOST_SERVER_LOG_PATH);
            formData.append(`host_${key}`, blob, `host_${key}.log`);
        } catch (error) {
            console.warn(`获取主机${host.address}的host_server日志失败`, error);
        }

        try {
            const blob = await this.downloadLogFile(makeVmApiUrl("host/download", host.address), SUPER_SDK_LOG_PATH);
            formData.append(`sdk_${key}`, blob, `sdk_${key}.log`);
        } catch (error) {
            console.warn(`获取主机${host.address}的super_sdk日志失败`, error);
        }

        try {
            const blob = await this.downloadLogFile(makeHostVmApiUrl("entry/download", host.address), DOCKER_LOG_PATH);
            formData.append(`docker_${key}`, blob, `docker_${key}.log`);
        } catch (error) {
            console.warn(`获取主机${host.address}的docker日志失败`, error);
        }
    }

    // download 接口失败时 HTTP 状态码仍是200，用 Content-Type 区分成功文件流和 {code,err} 错误体
    private async downloadLogFile(base: URL, path: string): Promise<Blob> {
        const url = new URL(base.toString());
        url.searchParams.set("path", path);
        const result = await fetch(url);
        const contentType = result.headers.get("Content-Type") ?? "";
        if (contentType.includes("application/json")) {
            const json = await result.json();
            throw new Error(json.err ?? "download failed");
        }
        return result.blob();
    }
}

export const feedbackApi = new FeedbackApi();
