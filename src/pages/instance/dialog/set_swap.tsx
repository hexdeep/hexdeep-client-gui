import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from "@/api/device_api";
import { i18n } from "@/i18n/i18n";
import { HostInfo } from "@/api/device_define";

@Dialog
export class SetSwapDialog extends CommonDialog<HostInfo, boolean> {
    public override width: string = "400px";

    protected form = {
        on: false,
        size: 4, // Default 4GB
    };

    public override async show(data: HostInfo) {
        this.title = this.$t("vmDetail.setSwap").toString();
        this.data = data;

        // Query current status: act=0
        try {
            const res = await deviceApi.setSwap(data.address, 0);
            this.form.on = res.on;
            if (res.size) {
                // Convert KB to GB.
                const sizeKB = parseFloat(res.size);
                if (!isNaN(sizeKB) && sizeKB > 0) {
                     // 1 GB = 1024 * 1024 KB
                     this.form.size = Math.round(sizeKB / (1024 * 1024));
                }
            }
        } catch (e) {
            console.warn("Failed to query swap status", e);
        }

        return super.show(data);
    }

    @ErrorProxy({ success: i18n.t("vmDetail.setSwapSuccess"), loading: i18n.t("loading") })
    protected override async onConfirm() {
        const act = this.form.on ? 1 : 2;
        let sizeStr = "0";
        if (this.form.on) {
            // Convert GB to KB
            const sizeKB = this.form.size * 1024 * 1024;
            sizeStr = sizeKB.toString();
        }

        await deviceApi.setSwap(this.data.address, act, sizeStr);
        this.close(true);
    }

    protected renderDialog(): VNode {
        return (
            <el-form label-width="120px">
                <el-form-item label={i18n.t("vmDetail.swapStatus")}>
                     <el-switch v-model={this.form.on} />
                </el-form-item>
                {this.form.on && (
                    <el-form-item label={i18n.t("vmDetail.swapSize")}>
                        <el-input-number
                            v-model={this.form.size}
                            min={4}
                            max={32}
                            label="GB"
                        />
                        <span style="margin-left: 10px">GB</span>
                    </el-form-item>
                )}
            </el-form>
        );
    }
}
