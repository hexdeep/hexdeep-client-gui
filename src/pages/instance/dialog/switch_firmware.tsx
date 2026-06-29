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
    protected uploading: boolean = false;
    protected uploadProgress: number = 0;
    protected uploadTask: { promise: Promise<any>, cancel: () => void; } | null = null;
    // 选择但尚未上传的自定义固件文件（点击确定时才上传并提示重启）
    protected customFirmwareFile: File | null = null;

    public override close(result?: boolean): Promise<boolean> {
        if (this.uploadTask) {
            this.uploadTask.cancel();
        }
        return super.close(result);
    }

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
        if (this.uploading) return;

        if (!this.customFirmwareFile && !this.selectedVersion) {
            this.$message.error(this.$t("notNull").toString());
            return;
        }

        // 确认切换/刷写固件需要重启设备
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

        // 优先刷写用户上传的自定义固件，否则切换到所选版本
        if (this.customFirmwareFile) {
            await this.uploadCustomFirmware();
        } else {
            await this.doSwitchFirmware();
        }
    }

    @ErrorProxy({ success: i18n.t("vmDetail.switchFirmwareSuccess"), loading: i18n.t("loading") })
    private async doSwitchFirmware() {
        await deviceApi.switchFirmwareVersion(this.data.host.address, this.selectedVersion);
        this.close(true);
    }

    // el-upload 选择文件回调：仅记录文件并在界面显示，点击确定时才二次确认并上传
    private onCustomFirmwareChange(file: any) {
        const raw: File = file?.raw ?? file;
        if (!raw) return;
        this.customFirmwareFile = raw;
        // 自定义固件与所选版本互斥，选择文件后清空版本选择
        this.selectedVersion = "";
    }

    private removeCustomFirmware() {
        if (this.uploading) return;
        this.customFirmwareFile = null;
    }

    // 上传并刷写已选择的自定义固件
    private async uploadCustomFirmware() {
        const raw = this.customFirmwareFile;
        if (!raw) return;

        this.uploading = true;
        this.uploadProgress = 0;
        try {
            this.uploadTask = deviceApi.uploadCustomFirmware(this.data.host.address, raw, (progressEvent) => {
                if (progressEvent.total > 0) {
                    this.uploadProgress = Math.round(progressEvent.loaded / progressEvent.total * 100);
                }
            });
            await this.uploadTask.promise;
            this.$message.success(this.$t("vmDetail.uploadFirmwareSuccess").toString());
            this.close(true);
        } catch (error) {
            if (error !== "aborted") {
                this.$alert(`${error}`, this.$t("error").toString(), { type: "error" });
            }
        } finally {
            this.uploadTask = null;
            this.uploading = false;
        }
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
                    {/* 该头部行必须放在 form-item 内容区，不能放进 slot="label"：
                        el-form-item 的 label 会被渲染成 <label> 元素，而 el-upload 的隐藏
                        <input type="file"> 一旦成为 <label> 的后代，input.click() 会冒泡到
                        <label> 并被浏览器原生地再次派发，导致文件选择框弹出两次。 */}
                    <div class="flex items-center gap-4" style={{ marginBottom: "8px", color: "#606266", fontSize: "14px", lineHeight: "1.4" }}>
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
                        <el-tooltip content={this.$t("vmDetail.uploadCustomFirmwareTooltip")} placement="top">
                          <el-upload
                              class="ms-auto"
                              action="#"
                              accept=".zip"
                              multiple={false}
                              attrs={{ "on-change": this.onCustomFirmwareChange }}
                              show-file-list={false}
                              auto-upload={false}
                              disabled={this.uploading}
                          >
                              <a class="hover:underline" style={{ color: "#409EFF", cursor: this.uploading ? "not-allowed" : "pointer" }}>
                                  {this.$t("vmDetail.uploadCustomFirmware")}
                              </a>
                          </el-upload>
                        </el-tooltip>
                    </div>
                    {this.customFirmwareFile && (
                        <div class="flex items-center gap-2" style={{ marginBottom: "10px" }}>
                            <i class="el-icon-document" style={{ color: "#409EFF" }}></i>
                            <span class="truncate" style={{ flex: "1", minWidth: "0" }}>{this.customFirmwareFile.name}</span>
                            <a
                                class="hover:underline"
                                style={{ color: this.uploading ? "#C0C4CC" : "#F56C6C", cursor: this.uploading ? "not-allowed" : "pointer" }}
                                onClick={() => this.removeCustomFirmware()}
                            >
                                {this.$t("vmDetail.removeCustomFirmware")}
                            </a>
                        </div>
                    )}
                    {this.uploading && (
                        <el-progress percentage={this.uploadProgress} style={{ marginBottom: "10px" }} />
                    )}
                    <el-select
                        v-model={this.selectedVersion}
                        disabled={this.uploading || !!this.customFirmwareFile}
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
