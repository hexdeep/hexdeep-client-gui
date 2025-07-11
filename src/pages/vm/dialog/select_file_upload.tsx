

import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { i18n } from "@/i18n/i18n";
import { DeviceInfo } from "@/api/device_define";


@Dialog
export class SelectFileUploadDialog extends CommonDialog<DeviceInfo, boolean> {

    private fileList: any[] = [];
    private path: string = "/sdcard";
    public override show(data: DeviceInfo) {
        this.title = this.$t("upload.title").toString();
        return super.show(data);
    }

    protected override async onConfirm() {
        if (this.fileList.isEmpty) {
            this.$message({ message: this.$t("upload.noFile").toString(), type: "warning" });
            return;
        }
        this.confirming();
    }

    @ErrorProxy({ success: i18n.t("upload.success"), loading: i18n.t("loading") })
    protected async confirming() {
        await deviceApi.upload(this.data.hostIp, this.data.name, `${this.path || "/sdcard"}/${this.fileList.first.raw.name}`, this.fileList.first.raw);
        this.close(true);
    }

    handleChange(file, fileList) {
        this.fileList = [file];
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this.data }} label-position="top">
                <el-form-item label={this.$t("upload.path")} prop="path">
                    <el-input v-model={this.path} maxlength={100} />
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
                        auto-upload={false}>

                        <i class="el-icon-upload"></i>
                        <div class="el-upload__text">
                            {this.$t("upload.tip")}
                        </div>
                        <div>
                            <span>
                                {this.fileList.length > 0 ? this.fileList[0].name : this.$t("upload.nofile")}
                            </span>
                        </div>
                    </el-upload >
                </el-form-item >
            </el-form >
        );
    }
}