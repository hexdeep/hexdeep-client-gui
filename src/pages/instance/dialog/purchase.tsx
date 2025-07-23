


import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { VNode } from "vue";
import s from './purchase.module.less';
import { PackageInfo, PurchaseInfo, PurchaseResult } from "@/api/order_define";
import { orderApi } from "@/api/order_api";
import { Column, Row } from "@/lib/container";
import { MyButton } from "@/lib/my_button";
import { ErrorProxy } from "@/lib/error_handle";
import { i18n } from "@/i18n/i18n";
import { PurchaseQrcodeDialog } from "./purchase_qrcode";

@Dialog
export class PurchaseDialog extends CommonDialog<PurchaseInfo, boolean> {
    protected packages: PackageInfo[] = [];
    protected selected: string[] = [];
    override width: string = "660px";
    public override height: string = "750px";

    public override async show(data: PurchaseInfo) {
        this.data = data;
        this.title = this.$t("instance.purchaseTitle").toString();
        this.packages = await orderApi.getPackages();
        if (this.packages.length > 0) this.data.package_id = this.packages.first.id;
        this.data.hosts.entries().toArray().forEach(([k, v]) => {
            v.forEach(x => {
                this.selected.push(`${k.device_id}_${x}`);
            });
        });
        return super.show(data);
    }

    protected override renderFooter() {
        return (
            <Row class={s.footer} crossAlign="center" mainAlign="space-between"  >
                <span>{this.$t("instance.total")}</span>
                <span class={s.calc}>{this.$t("instance.calc", {
                    0: this.selected.length,
                    1: (this.packages.find(x => x.id == this.data.package_id)?.price || 0) / 100,
                    2: this.$i18n.locale == "zh" ? this.packages.find(x => x.id == this.data.package_id)?.name : this.packages.find(x => x.id == this.data.package_id)?.english_name
                })}</span>
                <Row crossAlign="center" gap={5}>
                    <span>{this.$t("instance.calcTotal")}</span>
                    <span class={s.amount}>￥{this.selected.length * (this.packages.find(x => x.id == this.data.package_id)?.price || 0) / 100} {this.$t("instance.priceUnit")}</span>
                    <MyButton type="primary" style="margin-left:15px" onClick={this.purchaseNow}>{this.$t("instance.purchaseNow")}</MyButton>
                </Row>
            </Row>
        );
    }

    @ErrorProxy({ loading: i18n.t("loading"), })
    protected async purchaseNow() {
        var re: PurchaseResult = await orderApi.purchase(this.data.package_id, this.selected.join(","));
        this.$dialog(PurchaseQrcodeDialog).show(re).then(res => {
            if (res) {
                this.$message({
                    message: this.$t("instance.purchaseSuccess").toString(),
                    type: 'success'
                });
                this.close(true);
            }
        });
    }

    protected renderDialog(): VNode {
        return (
            <Column gap={20} style={{ padding: "20px" }} class={s.PurchaseDialog}>
                <el-card class="box-card">
                    <div slot="header" class="clearfix">
                        <span>{this.$t("instance.selectPackage")}</span>
                    </div>
                    <Row>
                        {this.packages.map(x => {
                            return (<div class={[s.package, `${this.data.package_id == x.id ? s.active : null}`]} onClick={() => this.data.package_id = x.id}>
                                {this.$i18n.locale == "zh" ? x.name : x.english_name}
                                <div class={s.price}>￥{x.price / 100} {this.$t("instance.priceUnit")}</div>
                            </div>);
                        })}
                    </Row>

                </el-card >
                <el-card class={s.instance}>
                    <div slot="header" class="clearfix">
                        <span>
                            {this.$t("instance.instance")}
                        </span>
                    </div>
                    <el-checkbox-group class={s.checkbox} v-model={this.selected}>
                        {this.data.hosts.entries().toArray().map(([k, v]) => {
                            return <Row wrap={true}>
                                {v.map(x =>
                                    <el-checkbox label={`${k.device_id}_${x}`} border size="medium">{`${k.address} ${this.$t("instance.instance")}-${x.toString().padStart(2, "0")}`}</el-checkbox>
                                )}
                            </Row>;
                        })}
                    </el-checkbox-group>
                </el-card>
            </Column >
        );
    }
}