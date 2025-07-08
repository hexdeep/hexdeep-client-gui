


import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { VNode } from "vue";
import s from './../instance.module.less';
import { HostDetail, RentalInfo } from "@/api/order_define";

@Dialog
export class InstancesDetailDialog extends CommonDialog<HostDetail, void> {
    protected list: (RentalInfo | undefined)[] = [];
    public override show(data: HostDetail) {
        this.data = data;
        this.title = `${this.$t("instance.host")}: ${this.data.host.address} (${this.$t("instance.title")})`;
        this.list = Array.from({ length: 12 }, (_, index) => this.data.rentals.find(x => x.index == index + 1));
        return super.show(data);
    }

    protected override renderFooter() {
        // ignore
    }

    protected renderExpire(obj: RentalInfo | undefined) {
        return (<span class={s[obj?.state ?? "expired"]}>
            {!obj && this.$t("instance.expired").toString()}
            {obj && `${obj.rental_end_time} (${this.$t("instance." + obj.state)})`}
        </span>
        );
    }

    protected renderDialog(): VNode {
        return (
            <div style={{ padding: "20px" }}>
                <el-table data={this.list} width="100%" height="100%" border>
                    <el-table-column label={this.$t("instance.index").toString()} formatter={(row, col, value, index) => `${this.$t("instance.instance")}${index + 1}`} />
                    <el-table-column label={this.$t("instance.expire").toString()} formatter={this.renderExpire} />
                </el-table>
            </div>
        );
    }
}