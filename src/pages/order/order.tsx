import { Column, Row } from "@/lib/container";
import Vue from "vue";
import { Component } from "vue-property-decorator";
import s from './order.module.less';
import { MyButton } from "@/lib/my_button";
import { orderApi } from "@/api/order_api";
import { HostInfo } from "@/api/device_define";
import { deviceApi } from "@/api/device_api";
import { OrderInfo } from "@/api/order_define";
import { i18n } from "@/i18n/i18n";
import { OrderDetailDialog } from "./dialog/order_detail";
import { Tools } from "@/common/common";

@Component
export default class OrderPage extends Vue {
    private hosts: HostInfo[] = [];
    private data: OrderInfo[] = [];
    private loading: boolean = false;
    protected async created() {
        this.loading = true;
        this.hosts = await deviceApi.getHosts();
        console.log(this.hosts);
        if (this.hosts && this.hosts.length > 0) {
            this.data = await orderApi.queryOrder(this.hosts.map(x => x.device_id).join(","));
            console.log(this.data);
        }
        this.loading = false;
    }
    protected render() {
        return (
            <div style={{ flex: 1 }}>
                <Column gap={20} class={["contentBox", s.Order]}>
                    <Column flex class={"fixTable"}>
                        <el-table data={this.data} width="100%" height="100%" v-loading={this.loading} emptyText={this.$t("order.empty")}>
                            <el-table-column prop="id" label={i18n.t("order.id")} />
                            <el-table-column prop="status" label={i18n.t("order.status")} align="center" formatter={(row: OrderInfo) => {
                                return row.status ? <el-tag type="success">{this.$t("order.paid")}</el-tag> : <el-tag type="danger">{this.$t("order.unpaid")}</el-tag>;
                            }} />
                            <el-table-column align="center" label={i18n.t("order.instanceNum")} formatter={(row: OrderInfo) => {
                                return row.detail.device_ids.split(',').length;
                            }} />
                            <el-table-column align="center" prop="payment_amount" label={i18n.t("order.paymentAmount")} formatter={(row: OrderInfo) => {
                                return (row.payment_amount / 100).toFixed(2);
                            }} />
                            <el-table-column prop="created_at" label={i18n.t("order.createdAt")} width="140" />
                            <el-table-column label={i18n.t("order.action")} formatter={this.renderAction} width="240" />
                        </el-table>
                    </Column>
                </Column>
            </div>
        );
    }

    private copy(str: string) {
        Tools.copyText(str).then(() => {
            this.$message({
                message: this.$t("order.copySuccess").toString(),
                type: 'success'
            });
        }).catch(e => {
            this.$message({
                message: this.$t("order.copyError").toString(),
                type: 'error'
            });
        });
    }

    private renderAction(row: OrderInfo) {
        return (
            <Row gap={8}>
                <MyButton size="mini" type="primary" text={i18n.t("order.copyOrderId")} onClick={() => this.copy(row.id)} />
                <MyButton size="mini" type="primary" text={i18n.t("order.detail")} onClick={() => this.$dialog(OrderDetailDialog).show(row)} />
            </Row>
        );
    }
}