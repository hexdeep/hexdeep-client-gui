

import { i18n } from "@/i18n/i18n";
import { Column } from "@/lib/container";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { VNode } from "vue";

const VersionConfigUrl = "http://static.newbingai.cn/package/cast-personal/exe/";

@Dialog
export class CastCheckDialog extends CommonDialog<void> {
    public override title: string = i18n.t("cast.check").toString();
    public downloadUrl = VersionConfigUrl + "同屏大师个人版_1.1.2.exe";
    protected created() {
        fetch(VersionConfigUrl + "version.json?t=" + Date.now()).then((res) => {
            res.json().then((data) => {
                if (data.url) {
                    if (data.url.startsWith("http")) {
                        this.downloadUrl = data.url;
                    } else {
                        this.downloadUrl = VersionConfigUrl + data.url;
                    }
                }
            });
        });
    }

    protected renderDialog(): VNode {
        return (
            <Column padding={40} gap={20}>
                <div>{i18n.t("cast.tip").toString()}</div>
                <div><a class={"link"} href={this.downloadUrl} download="同屏大师个人版.exe">{i18n.t("cast.downloadHere").toString()}</a></div>
            </Column>
        );
    }

    protected override renderFooter() {
        // ignore
    }
}