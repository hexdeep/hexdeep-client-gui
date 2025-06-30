

import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { VNode } from "vue";
import { OrderInfo } from "@/api/order_define";
import { Column } from "@/lib/container";

@Dialog
export class OrderDetailDialog extends CommonDialog<OrderInfo, void> {
    public override width: string = "650px";
    public override show(data: OrderInfo) {
        this.data = data;
        console.log(this.data);
        this.title = this.$t("order.detailTitle").toString();

        return super.show(data);
    }

    protected override renderFooter() {
        // ignore
    }

    protected renderDialog(): VNode {
        return (
            <el-descriptions size="medium" column={1} border labelStyle={{ "width": "150px" }} style={{ padding: "20px" }}>
                <el-descriptions-item label={i18n.t("order.id")}>
                    {this.data.id}
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("order.paymentAmount")}>
                    {(this.data.payment_amount / 100).toFixed(2)}
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("order.status")}>
                    {this.data.status ? <el-tag type="success">{this.$t("order.paid")}</el-tag> : <el-tag type="info">{this.$t("order.unpaid")}</el-tag>}
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("order.instanceNum")}>
                    {this.data.detail.device_ids.split(",").length}
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("order.instances")}>
                    <Column gap={5}>
                        {this.data.detail.device_ids.split(",").map(e => {
                            var tmp = e.split("_");
                            return <el-tag>{`${tmp[0]} - ${this.$t("order.instance")}${tmp[1]}`}</el-tag>;
                        })}
                    </Column>
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("order.createdAt")}>
                    {this.data.created_at}
                </el-descriptions-item>
            </el-descriptions >
        );
    }
}