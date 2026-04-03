import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { i18n } from "@/i18n/i18n";
import { HostInfo, FirmwareVersionInfo } from "@/api/device_define";

export interface SwitchFirmwareData {
    host: HostInfo;
    firmwareList: FirmwareVersionInfo[];
}

@Dialog
export class SwitchFirmwareDialog extends CommonDialog<SwitchFirmwareData, boolean> {
    public override width: string = "500px";
    protected versionList: FirmwareVersionInfo[] = [];
    protected selectedVersion: string = "";
    protected currentVersion: string = "";
    protected loading: boolean = true;

    public override async show(data: SwitchFirmwareData) {
        this.title = this.$t("vmDetail.switchFirmwareTitle").toString();
        this.data = data;
        this.loading = true;
        this.versionList = data.firmwareList;

        // 先打开对话框，再异步加载当前版本
        const result = super.show(data);
        this.loadCurrentVersion(data.host);
        return result;
    }

    private async loadCurrentVersion(host: HostInfo) {
        try {
            this.currentVersion = await deviceApi.getCurrentFirmwareVersion(host.address).catch(() => "");
        } finally {
            this.loading = false;
        }
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
        await deviceApi.switchFirmwareVersion(this.data.host.address, this.selectedVersion);
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
                <el-form-item>
                    <div slot="label" class="flex items-center gap-4">
                        <span>{this.$t("vmDetail.selectFirmwareVersion")}</span>
                        <el-tooltip content={this.$t("vmDetail.getFirmwarePackageTooltip")} placement="top">
                          <a
                              href="https://docs.hexdeep.com/h1/firmware.html"
                              target="_blank"
                              class="hover:underline"
                              style={{ marginRight: "10px", color: "#409EFF" }}
                          >
                              {this.$t("vmDetail.getFirmwarePackage")}
                          </a>
                        </el-tooltip>
                    </div>
                    <el-select
                        v-model={this.selectedVersion}
                        placeholder={this.$t("vmDetail.selectFirmwareVersion")}
                        style={{ width: "100%" }}
                    >
                        {this.versionList.map(item => (
                            <el-option key={item.version} value={item.version}>
                            <el-tooltip content={item.description} placement="top" disabled={item.description.length <= 30}>
                                <span class="block w-full">
                                    {item.version} {item.description ? '-' : ''} {item.description.length > 30 ? item.description.slice(0, 30) + "..." : item.description}
                                    {this.currentVersion === item.version && ` (${this.$t("vmDetail.currentVersion")})`}
                                </span>
                            </el-tooltip>
                            </el-option>
                        ))}
                    </el-select>
                </el-form-item>
            </el-form>
        );
    }
}
