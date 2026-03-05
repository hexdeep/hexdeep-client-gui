import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { VNode } from "vue";
import { HostInfo } from "@/api/device_define";
import { orderApi } from "@/api/order_api";
import { InstanceQuantityInfo } from "@/api/order_define";
import { Column, Row } from "@/lib/container";
import { MyButton } from "@/lib/my_button";
import { i18n } from "@/i18n/i18n";
import { deviceApi } from "@/api/device_api";
import { VipPurchaseDialog } from "./vip_purchase";
import { timeDiff } from "@/common/common";

export interface VipHostSelectData {
    hosts: HostInfo[];
}

interface HostWithVip extends HostInfo {
    vipInfo?: InstanceQuantityInfo;
    isExpired?: boolean;
}

@Dialog
export class VipHostSelectDialog extends CommonDialog<VipHostSelectData, boolean> {
    private hostList: HostWithVip[] = [];
    private selectedIds: string[] = [];
    private loading = false;
    override width: string = "700px";
    public override height: string = "600px";

    public override async show(data: VipHostSelectData) {
        this.data = data;
        this.title = this.$t("vip.selectHostTitle").toString();
        // 先初始化列表，再异步加载数据
        this.hostList = this.data.hosts.map(h => ({ ...h }));
        // 不等待，立即打开弹窗
        this.loadHostsVipInfo();
        return super.show(data);
    }

    private async loadHostsVipInfo() {
        this.loading = true;
        try {
            // 获取VIP信息（单独请求，不阻塞）
            const deviceIds = this.hostList.map(h => h.device_id).join(",");
            if (deviceIds) {
                orderApi.getInstanceQuantity(deviceIds).then(vipInfos => {
                    this.hostList.forEach(h => {
                        const info = vipInfos.find(v => v.id === h.device_id);
                        if (info) {
                            this.$set(h, 'vipInfo', info);
                            this.$set(h, 'isExpired', timeDiff(info.rental_end_time, info.current_time, "second") <= 0);
                        } else {
                            this.$set(h, 'isExpired', true);
                        }
                    });
                }).catch(e => console.warn(e));
            }

            // 并发获取型号信息，每个请求独立完成后立即更新UI
            this.hostList.forEach(h => {
                deviceApi.getWarehousingInfo(h.address).then(w => {
                    if (w.code === 200) {
                        this.$set(h, 'model', w.data.model);
                    }
                }).catch(e => {
                    // ignore
                });
            });
        } catch (error) {
            this.$message.error(`${error}`);
        }
        this.loading = false;
    }

    private formatHostDisplay(host: HostWithVip): string {
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

    private renderExpireStatus(host: HostWithVip) {
        if (!host.vipInfo || host.isExpired) {
            return <span style={{ color: "red" }}>{this.$t("vip.expired")}</span>;
        }
        return <span style={{ color: "green" }}>{host.vipInfo.rental_end_time}</span>;
    }

    protected override renderFooter() {
        return (
            <div class="dialog-footer">
                <MyButton 
                    type="primary" 
                    text={this.$t("vip.purchase")} 
                    disabled={this.selectedIds.length === 0}
                    onClick={this.onPurchase} 
                />
                <MyButton text={i18n.t("confirm.cancel")} onClick={() => this.close()} />
            </div>
        );
    }

    private async onPurchase() {
        const selectedHosts = this.hostList.filter(h => this.selectedIds.includes(h.device_id));
        const result = await this.$dialog(VipPurchaseDialog).show({
            hosts: selectedHosts
        });
        if (result) {
            this.close(true);
        }
    }

    protected renderDialog(): VNode {
        return (
            <Column gap={20} style={{ padding: "20px", height: "100%" }}>
                <div style={{ color: "#606266", fontSize: "14px" }}>{this.$t("vip.tip")}</div>
                <el-table 
                    data={this.hostList} 
                    height="100%" 
                    v-loading={this.loading}
                    on-selection-change={this.onSelectionChange}
                >
                    <el-table-column type="selection" width="55" />
                    <el-table-column 
                        label={this.$t("vip.hostInfo")} 
                        scopedSlots={{
                            default: ({ row }: { row: HostWithVip }) => {
                                return <span>{this.formatHostDisplay(row)}</span>;
                            }
                        }}
                    />
                    <el-table-column 
                        label={this.$t("vip.expireStatus")} 
                        width="200"
                        scopedSlots={{
                            default: ({ row }: { row: HostWithVip }) => {
                                return this.renderExpireStatus(row);
                            }
                        }}
                    />
                </el-table>
            </Column>
        );
    }

    private onSelectionChange(selection: HostWithVip[]) {
        this.selectedIds = selection.map(h => h.device_id);
    }
}
