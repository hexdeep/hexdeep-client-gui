import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { i18n } from "@/i18n/i18n";
import { DeviceInfo } from "@/api/device_define";
import { MyButton } from "@/lib/my_button";
import { Tool } from "@/common/Tools";
import { getSuffixName } from '@/common/common';
import s from './upload_file.module.less';
import { copyFileSync } from "node:fs";

interface UploadProgress {
    progress: number;
    start: boolean;
    starttm: number;
    bytesPerSecond: number;
}

@Dialog
export class UploadFileDialog extends CommonDialog<DeviceInfo[], boolean> {
    private ips: Record<string, DeviceInfo[]> = {};
    private fileList: any[] = [];
    private progresses: Record<string, UploadProgress> = {};
    private readonly = false;
    private item: any = { path: "/sdcard" };
    private responses: Record<string, any> = {};

    public override show(data: DeviceInfo[]) {
        this.ips = data.filter(x => x.state == "running").groupBy(x => x.hostIp);
        this.title = this.$t("upload.title").toString();
        if (data.length === 1) {
            const info = data.first;
            const vmInfo = `${info.hostIp}(${info.index}-${getSuffixName(info.name)})`;
            this.title = `${this.title} ${vmInfo}`;
        } else if (Object.keys(this.ips).length > 1) {
            this.title = `${this.title} (${Object.keys(this.ips).length})`;
        }
        return super.show(data);
    }

    protected override async onConfirm() {
        if (this.fileList.isEmpty) {
            this.$message({ message: this.$t("upload.noFile").toString(), type: "warning" });
            return;
        }
        this.confirming();
    }

    @ErrorProxy({ success: i18n.t("upload.success") })
    protected async confirming() {
        try {
            this.readonly = true;

            // 初始化进度条
            this.progresses = {};
            for (let ip of Object.keys(this.ips)) {
                for (const sdk of this.ips[ip].map(x => x.android_sdk)) {
                    this.progresses[sdk] = {
                        progress: 0,
                        start: true,
                        starttm: Date.now(),
                        bytesPerSecond: 0
                    };
                }
            }

            // 读取原始文件
            const fileRaw = this.fileList.first.raw;

            const uploadTasks: Promise<any>[] = [];


            for (let ip of Object.keys(this.ips)) {
                const android_sdks = this.ips[ip].map(x => x.android_sdk);
                for (const android_sdk of android_sdks) {
                    const task = (async () => {
                        // 这里复用外层读取的 arrayBuffer，直接创建新 File

                        try {
                            const res = await deviceApi.uploadToDockerMacvlanWithoutHandlerError(
                                android_sdk,
                                `${this.item.path || "/sdcard"}/${fileRaw.name}`,
                                fileRaw,
                                (progressEvent) => {
                                    const p = this.progresses[android_sdk];
                                    if (p) {
                                        p.progress = Math.round((progressEvent.progress || 0) * 100);
                                        p.bytesPerSecond = progressEvent.loaded / ((Date.now() - p.starttm) / 1000);
                                        this.progresses = { ...this.progresses };
                                    }
                                }
                            );

                            console.log(res.data);
                            this.responses[android_sdk] = res.data;
                            this.responses = { ...this.responses };
                            return res;
                        } catch (err) {
                            this.responses[android_sdk] = { code: 1, err: err || "upload fail" };
                        }

                    })();

                    uploadTasks.push(task);
                }
            }

            // 并行执行所有上传
            const results = await Promise.all(uploadTasks);
            console.log("上传结果：", results);

            this.close(true);
        } catch (error) {
            throw error;
        } finally {
            this.readonly = false;
        }
    }


    protected override renderFooter() {
        return (
            <div class="dialog-footer">
                <MyButton text={i18n.t("confirm.ok")} disabled={this.readonly} onClick={() => this.onConfirm()} type="primary" />
                <MyButton text={i18n.t("confirm.cancel")} onClick={() => this.close()} />
            </div>
        );
    }

    handleChange(file, fileList) {
        this.fileList = [file];
    }

    private formatSpeed(bytesPerSecond: number): string {
        return `${Tool.getFileSize(bytesPerSecond)}/s`;
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this.item }} label-position="top">
                <div style="margin-bottom: 10px;">{this.$t("upload.apkInstallTip")}</div>
                <el-form-item label={this.$t("upload.path")} prop="path">
                    <el-input v-model={this.item.path} maxlength={100} />
                </el-form-item>
                <el-form-item label={`${this.$t("upload.file")}(${Object.keys(this.responses).length}/${Object.keys(this.progresses).length})`}>
                    <el-upload
                        drag
                        multiple={false}
                        limit={2}
                        action="#"
                        attrs={{
                            "on-change": this.handleChange,
                        }}
                        file-list={this.fileList}
                        show-file-list={false}
                        auto-upload={false}
                        class={s.body}
                    >
                        <i class="el-icon-upload"></i>
                        <div class="el-upload__text">
                            {this.$t("upload.tip")}
                        </div>
                        <div>
                            <span class={s.file}>
                                {this.fileList.length > 0 ? this.fileList[0].name : this.$t("upload.nofile")}
                            </span>
                        </div>
                    </el-upload>

                    {/* 多进度条 */}
                    {Object.entries(this.progresses).map(([sdk, p]) => (
                        <div key={sdk} style={{ marginBottom: "12px" }}>
                            <div>{sdk}</div>
                            <el-progress percentage={p.progress} />
                            {p.start && (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    {this.$t("import.speed")}: {this.formatSpeed(p.bytesPerSecond)}
                                    {this.responses[sdk] && (
                                        <span
                                            style={{
                                                color: this.responses[sdk].code === 200 ? "green" : "red",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {this.responses[sdk].code === 200
                                                ? i18n.t("upload.success")
                                                : i18n.t("error") + `: ${this.responses[sdk].err || "Unknown error"}`}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </el-form-item>
            </el-form>
        );
    }
}