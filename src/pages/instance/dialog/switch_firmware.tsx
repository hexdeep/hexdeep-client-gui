import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { i18n } from "@/i18n/i18n";
import { HostInfo, FirmwareVersionInfo } from "@/api/device_define";

@Dialog
export class SwitchFirmwareDialog extends CommonDialog<HostInfo, boolean> {
    public override width: string = "500px";
    protected versionList: FirmwareVersionInfo[] = [];
    protected selectedVersion: string = "";
    protected currentVersion: string = "";
    protected loading: boolean = true;

    public override async show(data: HostInfo) {
        this.title = this.$t("vmDetail.switchFirmwareTitle").toString();
        this.data = data;
        this.loading = true;

        // 并发获取版本列表和当前版本
        const [versionList, currentVersion] = await Promise.all([
            deviceApi.getFirmwareVersionList(),
            deviceApi.getCurrentFirmwareVersion(data.address).catch(() => "")
        ]);

        // 按时间降序排序
        this.versionList = versionList.sort((a, b) => {
            return new Date(b.time).getTime() - new Date(a.time).getTime();
        });

        this.currentVersion = currentVersion;
        this.loading = false;

        return super.show(data);
    }

    protected override async onConfirm() {
        if (!this.selectedVersion) {
            this.$message.error(this.$t("notNull").toString());
            return;
        }

        // 确认切换版本需要重启设备
        try {
            await this.$confirm(
                this.$t("vmDetail.switchFirmwareRebootConfirm").toString(),
                this.$t("confirm.title").toString(),
                {
                    confirmButtonText: this.$t("confirm.ok").toString(),
                    cancelButtonText: this.$t("confirm.cancel").toString(),
                    type: "warning"
                }
            );
        } catch {
            return;
        }

        await this.doSwitchFirmware();
    }

    @ErrorProxy({ success: i18n.t("vmDetail.switchFirmwareSuccess"), loading: i18n.t("loading") })
    private async doSwitchFirmware() {
        await deviceApi.switchFirmwareVersion(this.data.address, this.selectedVersion);
        this.close(true);
    }

    protected renderDialog(): VNode {
        if (this.loading) {
            return (
                <div style={{ padding: "20px", textAlign: "center" }}>
                    <i class="el-icon-loading"></i> {this.$t("loading")}
                </div>
            );
        }

        return (
            <el-form label-position="top" style={{ padding: "20px" }}>
                {this.currentVersion && (
                    <el-form-item label={this.$t("vmDetail.currentFirmwareVersion")}>
                        <span>{this.currentVersion}</span>
                    </el-form-item>
                )}
                <el-form-item label={this.$t("vmDetail.selectFirmwareVersion")} required>
                    <el-select
                        v-model={this.selectedVersion}
                        placeholder={this.$t("vmDetail.selectFirmwareVersion")}
                        style={{ width: "100%" }}
                    >
                        {this.versionList.map(item => (
                            <el-option
                                key={item.version}
                                label={this.currentVersion === item.version
                                    ? `${item.version} (${this.$t("vmDetail.currentVersion")})`
                                    : item.version}
                                value={item.version}
                            />
                        ))}
                    </el-select>
                </el-form-item>
            </el-form>
        );
    }
}
