import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { DeviceInfo } from "@/api/device_define";
import { deviceApi } from "@/api/device_api";
import { Row } from "@/lib/container";
import { MyButton } from "@/lib/my_button";

@Dialog
export class ScreenMirrorDialog extends CommonDialog<DeviceInfo, void> {

    protected deviceInfo!: DeviceInfo;
    protected deviceId: string = "";
    protected isRunning: boolean = false;

    protected downloadUrl: string = "https://hexdeep.oss-cn-shanghai.aliyuncs.com/screen_mirror/app-arm64-v8a-release.zip";

    override width: string = "600px";

    public override show(data: DeviceInfo) {
        this.data = data;
        this.deviceInfo = data;
        this.title = this.$t("menu.screenMirror").toString();

        this.deviceId = i18n.t("loading").toString();
        this.loadDeviceId();

        return super.show(data);
    }

    /** 获取投屏 deviceId */
    @ErrorProxy({ loading: i18n.t("loading") })
    private async loadDeviceId() {
        this.deviceId = await deviceApi.screenMirrorId(this.deviceInfo.android_sdk, 0);
        if (this.deviceId) {
            await this.copyToClipboard(this.deviceId);
        }
    }

    /** 重新生成 deviceId */
    @ErrorProxy({ loading: i18n.t("loading"), success: i18n.t("screenMirror.regenerateSuccess") })
    private async regenerateDeviceId() {
        this.deviceId = i18n.t("loading").toString();
        this.deviceId = await deviceApi.screenMirrorId(this.deviceInfo.android_sdk, 1);
    }

    protected override renderFooter() {
        // ignore
    }

    @ErrorProxy({ loading: i18n.t("loading"), success: i18n.t("screenMirror.runSuccess") })
    private async startCast() {
        const newDeviceId = await deviceApi.screenMirrorRun(
            this.deviceInfo.android_sdk,
            0
        );

        this.isRunning = true;

        if (newDeviceId) {
            this.deviceId = newDeviceId;

            await this.copyToClipboard(newDeviceId);
        }
    }

    @ErrorProxy({ loading: i18n.t("loading"), success: i18n.t("success") })
    private async stopCast() {
        await deviceApi.screenMirrorRun(this.deviceInfo.android_sdk, 1);
        this.isRunning = false;
    }

    private async copyToClipboard(text: string) {
        if (!text) return;

        // https + 新浏览器
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            // 兼容 http / 老浏览器
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.style.position = "fixed";
            textarea.style.left = "-9999px";
            textarea.style.top = "-9999px";
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
        }
    }


    protected renderDialog(): VNode {
        return (
            <el-descriptions
                size="medium"
                column={1}
                border
                labelStyle={{ width: "120px" }}
                style={{ padding: "20px" }}
            >
                {/* 设备 ID */}
                <el-descriptions-item label={this.$t("screenMirror.deviceId")}>
                    <div style={{ position: "relative" }}>
                        <el-input
                            type="textarea"
                            v-model={this.deviceId}
                            rows={2}
                            readonly
                            resize="none"
                            class="plain-textarea"
                        />
                        <el-button
                            type="primary"
                            size="small"
                            style={{
                                position: "absolute",
                                right: "8px",
                                bottom: "6px",
                                padding: "4px 8px"
                            }}
                            onClick={this.regenerateDeviceId}
                        >
                            {this.$t("screenMirror.regenerate")}
                        </el-button>
                    </div>
                </el-descriptions-item>

                {/* 下载 */}
                <el-descriptions-item label={this.$t("screenMirror.download")}>
                    <el-link
                        type="primary"
                        href={this.downloadUrl}
                        target="_blank"
                        underline={false}
                    >
                        {this.$t("screenMirror.downloadClient")}
                    </el-link>
                </el-descriptions-item>

                {/* 操作 */}
                <el-descriptions-item label={this.$t("screenMirror.operate")}>
                    <Row gap={10}>
                        <MyButton type="danger" size="small" onClick={this.stopCast}>
                            {this.$t("screenMirror.stop")}
                        </MyButton>
                        <MyButton type="primary" size="small" onClick={this.startCast}>
                            {this.$t("screenMirror.run")}
                        </MyButton>
                    </Row>
                </el-descriptions-item>
            </el-descriptions>
        );
    }
}
