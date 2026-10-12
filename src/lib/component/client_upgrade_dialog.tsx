import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { VNode } from "vue";
import { Column } from "@/lib/container";
import { MyButton } from "@/lib/my_button";

export type ClientUpgradeKind = "purchase" | "feedback";

// hexdeep_server 的 302 接口：按 system 跳转到最新版 hexclient 安装包
const HEXCLIENT_DOWNLOAD_URL = "https://api.hexdeep.com/hexclient/download";

/** 按当前浏览器环境推断 hexclient 的 system 参数，推断不出时交给服务端默认值 */
function detectHexclientSystem(): string {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return "android";
    if (/windows/i.test(ua)) return "windows";
    if (/macintosh|mac os x/i.test(ua)) return "macos";
    if (/linux|x11/i.test(ua)) return "debian";
    return "";
}

export function hexclientDownloadUrl(): string {
    const system = detectHexclientSystem();
    return system ? `${HEXCLIENT_DOWNLOAD_URL}?system=${system}` : HEXCLIENT_DOWNLOAD_URL;
}

/** 老客户端已停用付费和反馈功能，用此遮罩引导用户下载新桌面客户端 */
@Dialog
export class ClientUpgradeDialog extends CommonDialog<{ kind: ClientUpgradeKind }, void> {
    public override width = "440px";

    public override async show(data: { kind: ClientUpgradeKind }) {
        this.title = this.$t(`clientUpgrade.title.${data.kind}`).toString();
        return super.show(data);
    }

    private download() {
        window.open(hexclientDownloadUrl(), "_blank");
    }

    protected renderDialog(): VNode {
        return (
            <Column gap={12} style={{ padding: "24px 20px", lineHeight: "1.7", color: "#606266" }}>
                <div>{this.$t(`clientUpgrade.message.${this.data.kind}`)}</div>
                <div style={{ fontSize: "12px", color: "#909399" }}>{this.$t("clientUpgrade.tip")}</div>
            </Column>
        );
    }

    protected override renderFooter(): any {
        return (
            <div class="dialog-footer">
                <MyButton type="primary" text={this.$t("clientUpgrade.download")} onClick={this.download} />
                <MyButton text={this.$t("confirm.cancel")} onClick={() => this.close()} />
            </div>
        );
    }
}
