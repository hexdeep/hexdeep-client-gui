import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { VNode } from "vue";
import { QrCode } from "./QrCode";

/**
 * V2 机型提取工具下载弹窗：仅展示扫码下载二维码
 */
@Dialog
export class V2ToolDownloadDialog extends CommonDialog<void, void> {
    public override title: string = this.$t("v2Tool.title").toString();
    public override width: string = "360px";
    private readonly url: string = "https://download.hexdeep.com/tools/HexV2.apk";

    protected override renderFooter() {
        // 仅展示二维码，使用右上角关闭按钮
    }

    protected renderDialog(): VNode {
        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", padding: "24px" }}>
                <QrCode qrData={this.url} size={200} />
                <div style={{ color: "#606266", fontSize: "13px", textAlign: "center", lineHeight: "1.6" }}>
                    {this.$t("v2Tool.hint")}
                </div>
            </div>
        );
    }
}
