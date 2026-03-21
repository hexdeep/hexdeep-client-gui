import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { VNode } from "vue";
import { HostInfo } from "@/api/device_define";
import { orderApi } from "@/api/order_api";
import { DeviceVipInfo } from "@/api/order_define";
import { Column, Row } from "@/lib/container";
import { MyButton } from "@/lib/my_button";
import { i18n } from "@/i18n/i18n";
import { deviceApi } from "@/api/device_api";
import { VipPurchaseDialog } from "./vip_purchase";
import { timeDiff } from "@/common/common";

export interface VipHostSelectData {
    hosts: HostInfo[];
    currentHost?: HostInfo; // 当前安卓容器所在的主机（可选，用于从更新镜像界面打开时高亮显示）
}

interface HostWithVip extends HostInfo {
    vipInfo?: DeviceVipInfo;
    isExpired?: boolean;
    isTrialedThisMonth?: boolean;
    trialLoading?: boolean;
}

@Dialog
export class VipHostSelectDialog extends CommonDialog<VipHostSelectData, boolean> {
    private hostList: HostWithVip[] = [];
    private selectedIds: string[] = [];
    private loading = false;
    private vipChanged = false; // 标记VIP状态是否发生变化（试用或购买）
    override width: string = "800px";
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
            // 每个主机单独请求 + 使用对应 hostIp
            this.hostList.forEach(h => {
                orderApi.getDeviceVipWithHost(h.address, h.device_id)
                    .then(vipInfos => {
                        const info = vipInfos?.[0];

                        if (info) {
                            this.$set(h, 'vipInfo', info);

                            const isExpired =
                                !info.rental_end_time ||
                                timeDiff(info.rental_end_time, info.current_time, "second") <= 0;

                            this.$set(h, 'isExpired', isExpired);
                            this.$set(h, 'isTrialedThisMonth', this.checkTrialedThisMonth(info.trial_time));
                        } else {
                            this.$set(h, 'isExpired', true);
                            this.$set(h, 'isTrialedThisMonth', false);
                        }
                    })
                    .catch(e => {
                        console.warn("getDeviceVipWithHost error:", h.address, e);
                        this.$set(h, 'isExpired', true);
                        this.$set(h, 'isTrialedThisMonth', false);
                    });
            });

            // 型号信息（保持不变）
            this.hostList.forEach(h => {
                deviceApi.getWarehousingInfo(h.address)
                    .then(w => {
                        if (w.code === 200) {
                            this.$set(h, 'model', w.data.model);
                        }
                    })
                    .catch(() => { });
            });

        } catch (error) {
            this.$message.error(`${error}`);
        }

        this.loading = false;
    }

    // 判断本月是否已试用
    private checkTrialedThisMonth(trialTime: string): boolean {
        if (!trialTime) return false;
        const now = new Date();
        const trialDate = new Date(trialTime);
        // 同年同月即为本月已试用
        return now.getFullYear() === trialDate.getFullYear() && now.getMonth() === trialDate.getMonth();
    }

    // 判断VIP是否有效（未过期）
    private isVipValid(host: HostWithVip): boolean {
        return !host.isExpired;
    }

    // 判断能否试用：VIP未生效且本月未试用
    private canTrial(host: HostWithVip): boolean {
        return host.isExpired === true && host.isTrialedThisMonth === false;
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

    private renderTrialButton(host: HostWithVip) {
        // VIP有效，不显示试用按钮
        if (this.isVipValid(host)) {
            return null;
        }
        // 本月已试用
        if (host.isTrialedThisMonth) {
            return <span style={{ color: "#909399", fontSize: "12px" }}>{this.$t("vip.trialUsed")}</span>;
        }
        // 可以试用
        return (
            <el-button
                type="warning"
                size="mini"
                loading={host.trialLoading}
                onClick={() => this.onTrial(host)}
            >
                {this.$t("vip.trial")}
            </el-button>
        );
    }

    private async onTrial(host: HostWithVip) {
        this.$set(host, 'trialLoading', true);
        try {
            await orderApi.trialDeviceVip(host.device_id);
            this.$message.success(this.$t("vip.trialSuccess").toString());
            this.vipChanged = true; // 标记VIP状态已变化
            // 重新加载VIP信息
            await this.loadHostsVipInfo();
        } catch (error) {
            this.$message.error(`${error}`);
        } finally {
            this.$set(host, 'trialLoading', false);
        }
    }

    protected override renderHeader() {
        return (
            <div class="dialog-header">
                <div class="dialog-title">{this.title}</div>
                <div class="dialog-close el-icon-close" onClick={() => this.close(this.vipChanged)} />
            </div>
        );
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
                <MyButton text={this.$t("vip.back")} onClick={() => this.close(this.vipChanged)} />
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
                            default: ({ row }: { row: HostWithVip; }) => {
                                return <span>{this.formatHostDisplay(row)}</span>;
                            }
                        }}
                    />
                    <el-table-column
                        label={this.$t("vip.expireStatus")}
                        width="180"
                        scopedSlots={{
                            default: ({ row }: { row: HostWithVip; }) => {
                                return this.renderExpireStatus(row);
                            }
                        }}
                    />
                    <el-table-column
                        label={this.$t("vip.operation")}
                        width="120"
                        scopedSlots={{
                            default: ({ row }: { row: HostWithVip; }) => {
                                return this.renderTrialButton(row);
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
