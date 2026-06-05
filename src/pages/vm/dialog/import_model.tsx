import { deviceApi } from "@/api/device_api";
import { DeviceInfo } from "@/api/device_define";
import { getSuffixName } from "@/common/common";
import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";

/**
 * 导入机型对话框：上传机型文件到容器，导入成功后由调用方重启容器
 */
@Dialog
export class ImportModelDialog extends CommonDialog<DeviceInfo, boolean> {
    public override width = "500px";
    private device: DeviceInfo | null = null;
    private fileList: any[] = [];

    public override show(data: DeviceInfo) {
        this.device = data;
        const info = `${data.hostIp}(${data.index}-${getSuffixName(data.name)})`;
        this.title = `${this.$t("importModel.title")} ${info}`;
        return super.show(data);
    }

    private handleChange(file: any) {
        this.fileList = [file];
    }

    @ErrorProxy({ success: i18n.t("importModel.success"), loading: i18n.t("loading") })
    protected override async onConfirm() {
        if (!this.device) throw new Error("device is null");
        if (this.fileList.isEmpty) {
            this.$message({ message: this.$t("importModel.noFile").toString(), type: "warning" });
            return false;
        }
        const file = this.fileList.first.raw as File;
        await deviceApi.importMobileModelFile(this.device.hostIp, this.device.name, file);
        this.close(true);
    }

    protected renderDialog(): VNode {
        return (
            <el-form label-position="top" style={{ padding: "10px 20px" }}>
                <el-form-item label={this.$t("importModel.file")}>
                    <el-upload
                        drag
                        multiple={false}
                        limit={1}
                        action="#"
                        attrs={{ "on-change": this.handleChange }}
                        file-list={this.fileList}
                        show-file-list={false}
                        auto-upload={false}
                        style={{ width: "100%" }}
                    >
                        <i class="el-icon-upload"></i>
                        <div class="el-upload__text">{this.$t("importModel.tip")}</div>
                        <div style={{ marginTop: "8px", color: "#909399", wordBreak: "break-all" }}>
                            {this.fileList.length > 0 ? this.fileList.first.name : this.$t("importModel.noFile")}
                        </div>
                    </el-upload>
                </el-form-item>
            </el-form>
        );
    }
}
