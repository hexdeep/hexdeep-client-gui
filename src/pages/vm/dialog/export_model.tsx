import { deviceApi } from "@/api/device_api";
import { DeviceInfo } from "@/api/device_define";
import { getSuffixName, makeVmApiUrl } from "@/common/common";
import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";

/**
 * 导出机型对话框：导出容器机型文件并下载到本地
 */
@Dialog
export class ExportModelDialog extends CommonDialog<DeviceInfo, boolean> {
    public override width = "460px";
    private device: DeviceInfo | null = null;
    // 是否导出随机生成的文件
    private exportRandomData = false;

    public override show(data: DeviceInfo) {
        this.device = data;
        const info = `${data.hostIp}(${data.index}-${getSuffixName(data.name)})`;
        this.title = `${this.$t("exportModel.title")} ${info}`;
        return super.show(data);
    }

    @ErrorProxy({ success: i18n.t("exportModel.success"), loading: i18n.t("loading") })
    protected override async onConfirm() {
        if (!this.device) throw new Error("device is null");
        // 获取机型文件在主机上的绝对路径
        const path = await deviceApi.exportMobileModelFile(this.device.hostIp, this.device.name, this.exportRandomData);
        // 通过主机下载接口下载该文件
        const link = makeVmApiUrl("host/download", this.device.hostIp) + `?path=${path}`;
        location.href = link;
        this.close(true);
    }

    protected renderDialog(): VNode {
        return (
            <el-form label-position="top" style={{ padding: "10px 20px" }}>
                <el-form-item label={this.$t("exportModel.exportRandomData")}>
                    <el-switch v-model={this.exportRandomData} />
                </el-form-item>
            </el-form>
        );
    }
}
