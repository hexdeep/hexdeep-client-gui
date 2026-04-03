import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { i18n } from "@/i18n/i18n";
import { DeviceInfo, FirmwareVersionInfo } from "@/api/device_define";

@Dialog
export class BatchSwitchFirmwareDialog extends CommonDialog<DeviceInfo[], boolean> {
    public override width: string = "500px";
    protected versionList: FirmwareVersionInfo[] = [];
    protected selectedVersion: string = "";
    protected loading: boolean = true;
    protected uniqueHosts: string[] = [];

    public override async show(data: DeviceInfo[]) {
        this.title = this.$t("batch.switchFirmwareTitle").toString();
        this.data = data;
        this.loading = true;
        
        // 去重获取唯一的主机IP列表
        this.uniqueHosts = [...new Set(data.map(d => d.hostIp))];
        
        const result = super.show(data);
        this.loadFirmwareList();
        return result;
    }

    private async loadFirmwareList() {
        try {
            const list = await deviceApi.getFirmwareVersionList();
            this.versionList = list.sort((a, b) =>
                new Date(b.time).getTime() - new Date(a.time).getTime()
            );
        } catch (e) {
            console.warn(e);
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
                this.$t("batch.switchFirmwareConfirm", [this.uniqueHosts.length]).toString(),
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

    @ErrorProxy({ success: i18n.t("batch.switchFirmwareSuccess"), loading: i18n.t("loading") })
    private async doSwitchFirmware() {
        // 并行调用所有主机的固件切换接口
        const tasks = this.uniqueHosts.map(hostIp =>
            deviceApi.switchFirmwareVersion(hostIp, this.selectedVersion).catch(e => {
                console.error(`Failed to switch firmware for ${hostIp}:`, e);
                throw e;
            })
        );
        await Promise.allSettled(tasks);
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
                <el-form-item label={this.$t("batch.affectedHosts")}>
                    <div style={{ maxHeight: "100px", overflowY: "auto", color: "#606266" }}>
                        {this.uniqueHosts.join(", ")}
                    </div>
                </el-form-item>
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
