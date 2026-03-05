import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { VNode } from "vue";
import { HostInfo } from "@/api/device_define";
import { orderApi } from "@/api/order_api";
import { InstanceQuantityPackage, PurchaseResult } from "@/api/order_define";
import { Column, Row } from "@/lib/container";
import { MyButton } from "@/lib/my_button";
import { ErrorProxy } from "@/lib/error_handle";
import { i18n } from "@/i18n/i18n";
import { PurchaseQrcodeDialog } from "@/pages/instance/dialog/purchase_qrcode";
import s from './vip_purchase.module.less';

export interface VipPurchaseData {
    hosts: HostInfo[];
}

@Dialog
export class VipPurchaseDialog extends CommonDialog<VipPurchaseData, boolean> {
    private packages: InstanceQuantityPackage[] = [];
    private selectedPackageId: number = 0;
    override width: string = "660px";
    public override height: string = "550px";

    public override async show(data: VipPurchaseData) {
        this.data = data;
        this.title = this.$t("vip.purchaseTitle").toString();
        this.packages = await orderApi.getInstanceQuantityPackages();
        if (this.packages.length > 0) {
            this.selectedPackageId = this.packages[0].id;
        }
        return super.show(data);
    }

    private get selectedPackage(): InstanceQuantityPackage | undefined {
        return this.packages.find(p => p.id === this.selectedPackageId);
    }

    private get totalPrice(): number {
        const pkg = this.selectedPackage;
        if (!pkg) return 0;
        return (pkg.price / 100) * this.data.hosts.length;
    }

    protected override renderFooter() {
        return (
            <Row class={s.footer} crossAlign="center" mainAlign="space-between">
                <span>{this.$t("instance.total")}</span>
                <span class={s.calc}>{this.$t("vip.calc", {
                    0: this.data.hosts.length,
                    1: (this.selectedPackage?.price || 0) / 100,
                    2: this.$i18n.locale === "zh" 
                        ? this.selectedPackage?.name 
                        : this.selectedPackage?.english_name
                })}</span>
                <Row crossAlign="center" gap={5}>
                    <span>{this.$t("instance.calcTotal")}</span>
                    <span class={s.amount}>￥{this.totalPrice} {this.$t("instance.priceUnit")}</span>
                    <MyButton type="primary" style="margin-left:15px" onClick={this.purchaseNow}>
                        {this.$t("instance.purchaseNow")}
                    </MyButton>
                </Row>
            </Row>
        );
    }

    @ErrorProxy({ loading: i18n.t("loading") })
    private async purchaseNow() {
        const deviceIds = this.data.hosts.map(h => h.device_id).join(",");
        const result: PurchaseResult = await orderApi.purchaseInstanceQuantity(
            this.selectedPackageId,
            deviceIds
        );
        this.$dialog(PurchaseQrcodeDialog).show(result).then(res => {
            if (res) {
                this.$message({
                    message: this.$t("instance.purchaseSuccess").toString(),
                    type: 'success'
                });
                this.close(true);
            }
        });
    }

    private formatHostDisplay(host: HostInfo): string {
        let text = host.address;
        if (host.model && host.remark) {
            text = `${host.address}(${host.model})-${host.remark}`;
        } else if (host.model) {
            text = `${host.address}(${host.model})`;
        } else if (host.remark) {
            text = `${host.address}-${host.remark}`;
        }
        return text;
    }

    protected renderDialog(): VNode {
        return (
            <Column gap={20} style={{ padding: "20px" }} class={s.VipPurchaseDialog}>
                <el-card class="box-card">
                    <div slot="header" class="clearfix">
                        <span>{this.$t("instance.selectPackage")}</span>
                    </div>
                    <Row>
                        {this.packages.map(x => {
                            return (
                                <div 
                                    class={[s.package, this.selectedPackageId === x.id ? s.active : null]} 
                                    onClick={() => this.selectedPackageId = x.id}
                                >
                                    {this.$i18n.locale === "zh" ? x.name : x.english_name}
                                    <div class={s.price}>￥{x.price / 100} {this.$t("instance.priceUnit")}</div>
                                </div>
                            );
                        })}
                    </Row>
                </el-card>
                <el-card class={s.hostList}>
                    <div slot="header" class="clearfix">
                        <span>{this.$t("vip.selectedHosts")}</span>
                    </div>
                    <div class={s.hostItems}>
                        {this.data.hosts.map(host => (
                            <div class={s.hostItem}>
                                {this.formatHostDisplay(host)}
                            </div>
                        ))}
                    </div>
                </el-card>
            </Column>
        );
    }
}
