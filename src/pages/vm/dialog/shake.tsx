import { deviceApi } from "@/api/device_api";
import { DeviceInfo } from "@/api/device_define";
import { getSuffixName } from "@/common/common";
import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";

/**
 * 摇一摇设置对话框：设置安卓容器摇一摇时间因子（0-300，0 表示关闭）
 */
@Dialog
export class ShakeDialog extends CommonDialog<DeviceInfo, boolean> {
    public override width = "480px";
    private device: DeviceInfo | null = null;
    private loading = false;
    // 摇一摇时间因子：值越大，传感器处于摇一摇状态的时间越长，0 表示关闭
    private count = 0;

    public override show(data: DeviceInfo) {
        this.device = data;
        this.title = `${this.$t("shake.title")} ${data.hostIp}(${data.index}-${getSuffixName(data.name)})`;
        return super.show(data);
    }

    protected override async onInit() {
        if (!this.device) return;
        try {
            this.loading = true;
            this.count = (await deviceApi.getShake(this.device.android_sdk)) || 0;
        } catch (error) {
            this.$message.error(`${error}`);
        } finally {
            this.loading = false;
        }
    }

    @ErrorProxy({ success: i18n.t("success"), loading: i18n.t("loading") })
    protected override async onConfirm() {
        if (!this.device) throw new Error("device is null");
        await deviceApi.setShake(this.device.android_sdk, this.count);
        this.close(true);
    }

    protected renderDialog(): VNode {
        return (
            <div v-loading={this.loading} style={{ padding: "20px 30px" }}>
                <el-form label-position="top">
                    <el-form-item label={this.$t("shake.count")}>
                        <el-slider v-model={this.count} min={0} max={300} show-input style={{ width: "100%" }} />
                    </el-form-item>
                    <div style={{ color: "#909399", fontSize: "12px", lineHeight: "1.6" }}>
                        {this.$t("shake.hint")}
                    </div>
                </el-form>
            </div>
        );
    }
}
