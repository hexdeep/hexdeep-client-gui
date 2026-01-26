import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { DiscoverInfo } from "@/api/device_define";
import { VNode } from "vue";
import { deviceApi } from "@/api/device_api";
import { Config } from "@/common/Config";
import { i18n } from "@/i18n/i18n";

@Dialog
export class DiscoverDialog extends CommonDialog<void, boolean> {
    public override width = "500px";

    protected form: DiscoverInfo = {
        auto: false,
        host_ips: []
    };

    private ipListText: string = "";

    public override show() {
        this.title = i18n.t("discover.title").toString();
        return super.show();
    }

    protected override async onInit() {
        try {
            console.log("DiscoverDialog onInit");
            const result = await deviceApi.setDiscover(Config.host, 0);
            console.log("setDiscover result:", result);
            if (result) {
                this.form = result;
                // Use result directly to avoid any potential reactivity timing issues, though unlikely for sync assignment
                const ips = result.host_ips;
                this.ipListText = Array.isArray(ips) ? ips.join('\n') : "";
            }
        } catch (e) {
            console.error("DiscoverDialog init error:", e);
            this.$message.error(this.$t("discover.loadError") + ": " + e);
        }
    }

    protected renderDialog(): VNode {
        return (
            <div style={{ padding: "20px" }} v-loading={!this.form}>
                <el-form label-width="120px">
                    <el-form-item label={this.$t("discover.mode") as string}>
                        <el-switch
                            v-model={this.form.auto}
                            active-text={this.$t("discover.auto") as string}
                            inactive-text={this.$t("discover.manual") as string}
                            active-value={true}
                            inactive-value={false}
                        />
                    </el-form-item>
                    {!this.form.auto && (
                        <el-form-item label={this.$t("discover.ipList") as string}>
                            <el-input
                                type="textarea"
                                v-model={this.ipListText}
                                rows={6}
                                placeholder={this.$t("discover.placeholder") as string}
                            />
                        </el-form-item>
                    )}
                </el-form>
            </div>
        );
    }

    protected override async onConfirm() {
        try {
            const hostIpsStr = this.ipListText.split('\n').map(x => x.trim()).filter(x => x).join(',');
            await deviceApi.setDiscover(Config.host, 1, this.form.auto, hostIpsStr);
            this.$message.success(this.$t("discover.saveSuccess") as string);
            this.close(true);
        } catch (e) {
            this.$message.error(this.$t("discover.saveError") as string);
        }
    }
}
