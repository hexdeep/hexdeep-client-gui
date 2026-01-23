


import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { VNode } from "vue";
import s from './purchase_qrcode.module.less';
import { PurchaseResult } from "@/api/order_define";
import { QrCode } from "@/lib/component/QrCode";
import { Column, Row } from "@/lib/container";
import { timeDiff } from "@/common/common";
import { orderApi } from "@/api/order_api";

@Dialog
export class PurchaseQrcodeDialog extends CommonDialog<PurchaseResult, boolean> {
    private timer: any;
    private qrcodeExpired: boolean = false;
    public override width: string = "350px";
    public override show(data: PurchaseResult) {
        this.data = data;
        this.title = this.$t("instance.purchaseQrcodeTitle").toString();
        this.timer = setInterval(() => {
            this.checkOrder();
        }, 1000);
        return super.show(data);
    }

    private async checkOrder() {
        var re = await orderApi.queryOrderState(this.data.order_id);
        if (re == "支付成功") {
            clearInterval(this.timer);
            this.timer = null;
            this.close(true);
            return;
        }
        this.qrcodeExpired = (timeDiff(this.data.expire_time, new Date(), "second") < 1);
        if (timeDiff(this.data.expire_time, new Date(), "second") < 1) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    protected destroyed() {
        if (this.timer) clearInterval(this.timer);
    }

    protected override renderFooter() {
        // ignore
    }


    protected renderDialog(): VNode {
        return (
            <div class={s.qrCode}>
                <Column mainAlign="center" crossAlign="center" >
                    <Row gap={20} crossAlign="center">
                        <img src="/img/0.jpg" class={s.wxlogo}></img>
                        <div class={s.desc}>{this.$t("instance.purchaseQrcodeDesc").toString()} </div>
                    </Row>
                    <div style={{ "position": "relative" }}>
                        <QrCode qrData={this.data.url} size={350} />
                        {this.qrcodeExpired && <div class={s.expired}>
                            {this.$t("instance.qrcodeExpired")}
                        </div>}
                    </div>
                    <div > {this.$t("instance.qrcodeExpire", { 0: (timeDiff(this.data.expire_time, this.data.current_time, "second") / 60).toFixed(0) })} </div>
                </Column>
            </div>
        );
    }
}
