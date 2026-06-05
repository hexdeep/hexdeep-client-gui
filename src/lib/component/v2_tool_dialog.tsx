import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { VNode } from "vue";
import { QrCode } from "./QrCode";

/**
 * 机型提取工具下载弹窗：以 tabs 形式分别展示各版本工具，目前仅 V2（V3 待完成）
 */
@Dialog
export class V2ToolDownloadDialog extends CommonDialog<void, void> {
    public override title: string = this.$t("v2Tool.title").toString();
    public override width: string = "360px";
    private activeTab: string = "v2";
    private readonly v2Url: string = "https://download.hexdeep.com/tools/HexV2.apk";
    // 带时间戳的下载地址，避免浏览器/代理缓存该 URL
    private v2QrUrl: string = "";

    protected override onInit() {
        this.v2QrUrl = `${this.v2Url}?t=${Date.now()}`;
    }

    protected override renderFooter() {
        // 仅展示二维码，使用右上角关闭按钮
    }

    protected renderDialog(): VNode {
        return (
            <el-tabs value={this.activeTab} onInput={(v: string) => (this.activeTab = v)}>
                <el-tab-pane label="V2" name="v2">
                    {this.renderQr(this.v2QrUrl)}
                </el-tab-pane>
            </el-tabs>
        );
    }

    /** 复制下载链接到剪贴板 */
    private async copyUrl(url: string) {
        await this.copyToClipboard(url);
        this.$message.success(this.$t("v2Tool.copySuccess").toString());
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
