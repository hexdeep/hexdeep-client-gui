import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { VNode } from "vue";
import { QrCode } from "./QrCode";

@Dialog
export class MobileModelToolDownloadDialog extends CommonDialog<{ version: "v2" | "v3"; }, void> {
    public override title: string = this.$t("v2Tool.title").toString();
    public override width: string = "360px";

    private activeTab: string = "v2";
    private version: "v2" | "v3" = "v2";
    private downloadUrl: string = "";

    protected override onInit() {
        // 根据传入版本初始化下载链接
        this.version = this.data?.version || "v2";
        this.downloadUrl = this.getDownloadUrl(this.version);
        this.activeTab = this.version;
    }

    protected override renderFooter() {
        // 仅展示二维码和关闭按钮
    }

    protected renderDialog(): VNode {
        return (
            <el-tabs value={this.activeTab} onInput={(v: string) => (this.activeTab = v)}>
                <el-tab-pane label="V2" name="v2">
                    {this.version === "v2" && this.renderQr(this.downloadUrl)}
                </el-tab-pane>
                <el-tab-pane label="V3" name="v3">
                    {this.version === "v3" && this.renderQr(this.downloadUrl)}
                </el-tab-pane>
            </el-tabs>
        );
    }

    /** 根据版本生成下载链接 */
    private getDownloadUrl(version: "v2" | "v3"): string {
        if (version === "v2") {
            return `https://download.hexdeep.com/tools/HexV2.apk?t=${Date.now()}`;
        } else if (version === "v3") {
            return `https://download.hexdeep.com/tools/HexV3.apk?t=${Date.now()}`;
        }
        return "";
    }

    private async copyUrl(url: string) {
        await this.copyToClipboard(url);
        this.$message.success(this.$t("v2Tool.copySuccess").toString());
    }

    private async copyToClipboard(text: string) {
        if (!text) return;
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
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

    private renderQr(url: string): VNode {
        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", padding: "24px" }}>
                <QrCode qrData={url} size={200} />
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#409eff", fontSize: "13px", wordBreak: "break-all", textAlign: "center" }}
                >
                    {url}
                </a>
                <el-button
                    type="primary"
                    size="mini"
                    icon="el-icon-document-copy"
                    onClick={() => this.copyUrl(url)}
                >
                    {this.$t("v2Tool.copy")}
                </el-button>
                <div style={{ color: "#606266", fontSize: "13px", textAlign: "center", lineHeight: "1.6" }}>
                    {this.$t("v2Tool.hint")}
                </div>
            </div>
        );
    }
}