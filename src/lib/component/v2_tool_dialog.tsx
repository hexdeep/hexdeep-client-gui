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

    protected override renderFooter() {
        // 仅展示二维码，使用右上角关闭按钮
    }

    protected renderDialog(): VNode {
        return (
            <el-tabs value={this.activeTab} onInput={(v: string) => (this.activeTab = v)}>
                <el-tab-pane label="V2" name="v2">
                    {this.renderQr(this.v2Url)}
                </el-tab-pane>
            </el-tabs>
        );
    }

    private renderQr(url: string): VNode {
        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", padding: "24px" }}>
                <QrCode qrData={url} size={200} />
                <div style={{ color: "#606266", fontSize: "13px", textAlign: "center", lineHeight: "1.6" }}>
                    {this.$t("v2Tool.hint")}
                </div>
            </div>
        );
    }
}
