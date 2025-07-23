
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { i18n } from "@/i18n/i18n";
import { DeviceInfo } from "@/api/device_define";
import { MyButton } from "@/lib/my_button";
import { Tool } from "@/common/Tools";
import s from './upload_file.module.less';


@Dialog
export class UploadFileDialog extends CommonDialog<DeviceInfo[], boolean> {
    private ips: Record<string, DeviceInfo[]> = {};
    private fileList: any[] = [];
    private progress = { progress: 0, start: false, starttm: Date.now(), bytesPerSecond: 0 };
    private readonly = false;
    private item: any = { path: "/sdcard" };

    public override show(data: DeviceInfo[]) {
        this.ips = data.filter(x => x.state == "running").groupBy(x => x.hostIp);
        //console.log(this.ips);
        this.title = this.$t("upload.title").toString();
        if (Object.keys(this.ips).length > 1) this.title = `${this.title} (${Object.keys(this.ips).length})`;
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
            this.progress.start = true;
            this.progress.progress = 0;
            this.progress.starttm = Date.now();
            this.progress.bytesPerSecond = 0;
            for (let ip of Object.keys(this.ips)) {
                let names = this.ips[ip].map(x => x.name).join(",");
                let re = await deviceApi.uploadToDocker(ip, names, `${this.item.path || "/sdcard"}/${this.fileList.first.raw.name}`, this.fileList.first.raw, (progressEvent) => {
                    // console.log(progressEvent);
                    this.progress.progress = Math.round((progressEvent.progress || 0) * 100 / Object.keys(this.ips).length);
                    this.progress.bytesPerSecond = progressEvent.loaded / ((Date.now() - this.progress.starttm) / 1000);
                });
                console.log(re);
            }
            // await deviceApi.upload(this.data.hostIp, this.data.name, `${this.path || "/sdcard"}/${this.fileList.first.raw.name}`, this.fileList.first.raw);
            console.log("close");
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

    private formatSpeed(): string {

        return `${Tool.getFileSize(this.progress.bytesPerSecond)}/s`;
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this.item }} label-position="top">
                <el-form-item label={this.$t("upload.path")} prop="path">
                    <el-input v-model={this.item.path} maxlength={100} />
                </el-form-item>
                <el-form-item label={this.$t("upload.file")}  >
                    <el-upload drag
                        multiple={false}
                        limit={2}
                        action="#"
                        attrs={{
                            "on-change": this.handleChange,
                        }}
                        file-list={this.fileList}
                        show-file-list={false}
                        auto-upload={false} class={s.body}>


                        <i class="el-icon-upload"></i>
                        <div class="el-upload__text">
                            {this.$t("upload.tip")}
                        </div>
                        <div>
                            <span class={s.file}>
                                {this.fileList.length > 0 ? this.fileList[0].name : this.$t("upload.nofile")}
                            </span>
                        </div>
                    </el-upload >
                    {this.progress.start && <el-progress percentage={this.progress.progress} />}
                    {this.progress.start && <div class={s.speed}>{this.$t("import.speed")}: {this.formatSpeed()}</div>}
                    {this.progress.progress == 100 && <div class={s.speed}>{this.$t("import.copying")}</div>}
                </el-form-item >
            </el-form >
        );
    }
}