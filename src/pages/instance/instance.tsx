import { Column, Row } from "@/lib/container";
import { MyButton } from "@/lib/my_button";
import Vue from "vue";
import { Component } from "vue-property-decorator";
import s from './instance.module.less';
import { InstanceTag } from "./instance_tag";
import { HostInfo } from "@/api/device_define";
import { deviceApi } from "@/api/device_api";
import { orderApi } from "@/api/order_api";
import { PurchaseInfo, RentalInfo, RentalRecord } from "@/api/order_define";
import { i18n } from "@/i18n/i18n";
import { InstancesDetailDialog } from "./dialog/instances_detail";
import { PurchaseDialog } from "./dialog/purchase";
import { SwitchSDKDialog } from "./dialog/switch_sdk";
import { HostDetailDialog } from "./dialog/host_detail_new";

@Component
export default class InstancePage extends Vue {
    private loading = true;
    private data: HostInfo[] = [];
    private checkList: string[] = [];
    private record: RentalRecord[] = [];
    protected async created() {
        await this.refresh();
    }

    protected async refresh() {
        this.loading = true;
        try {
            this.data = await deviceApi.getHosts();
            this.record = await orderApi.getRental(this.data.map(x => x.device_id).join(",")) || [];
        } catch (error) {
            this.$alert(`${error}`, this.$t("error").toString(), { type: "error" });
        }
        this.loading = false;
    }

    protected purchase() {
        let purchaseInfo: PurchaseInfo = {
            package_id: 0,
            hosts: new Map(),
        };
        this.checkList.forEach(x => {
            let arr = x.split("-");
            let host = this.data.find(y => y.address == arr[0]);
            if (host) {
                var lst: number[] = [];
                if (purchaseInfo.hosts.has(host)) {
                    lst = purchaseInfo.hosts.get(host) || [];
                } else {
                    purchaseInfo.hosts.set(host, lst);
                }
                lst.push(parseInt(arr[1]));
            }
        });

        if (purchaseInfo.hosts.size < 1) {
            this.$alert(this.$t("instance.needSelect").toString());
            return;
        }
        this.$dialog(PurchaseDialog).show(purchaseInfo).then(e => {
            if (e) {
                this.refresh();
            }
        });
    }

    private setCheck(e: boolean, val: string) {
        if (e) {
            this.data.forEach(x => {
                var rec = this.record.find(a => x.device_id == a.device_id);
                for (let i = 1; i <= 12; i++) {
                    var str = `${x.address}-${i}`;
                    if (rec?.device_indexes.contains(y => y.index == i && y.state == val) || (val == "expired" && !rec?.device_indexes.contains(y => y.index == i))) {
                        if (!this.checkList.includes(str)) this.checkList.push(str);
                    }
                }
            });
        } else {
            this.data.forEach(x => {
                var rec = this.record.find(a => x.device_id == a.device_id);
                for (let i = 1; i <= 12; i++) {
                    var str = `${x.address}-${i}`;
                    if (rec?.device_indexes.contains(y => y.index == i && y.state == val) || (val == "expired" && !rec?.device_indexes.contains(y => y.index == i))) {
                        this.checkList.removeWhere(t => t == str);
                    }
                }
            });
        }
    }

    protected render() {
        return (
            <div style={{ flex: 1 }}>
                <Column gap={20} class={["contentBox", s.Instance]}>
                    <Row mainAlign="space-between">
                        <Row crossAlign="center" gap={20}>
                            <MyButton type="primary" text={i18n.t("instance.purchase").toString()} onClick={this.purchase} />
                            {this.$t("instance.select").toString()}
                            <Row class={s.selects}>
                                {/* <el-checkbox onChange={(e) => this.setCheck(e, "free")}>{i18n.t("instance.free").toString()}</el-checkbox> */}
                                <el-checkbox onChange={(e) => this.setCheck(e, "normal")}>{i18n.t("instance.normal").toString()}</el-checkbox>
                                <el-checkbox onChange={(e) => this.setCheck(e, "expiring")}>{i18n.t("instance.expiring").toString()} </el-checkbox>
                                <el-checkbox onChange={(e) => this.setCheck(e, "expired")}>{i18n.t("instance.expired").toString()}</el-checkbox>
                            </Row>
                        </Row>
                        <Row gap={20} crossAlign="center">
                            {/* <InstanceTag value="无实例" text={i18n.t("instance.free").toString()} /> */}
                            <InstanceTag value="正常" text={i18n.t("instance.normal").toString()} />
                            <InstanceTag value="即将到期" text={i18n.t("instance.expiring").toString()} />
                            <InstanceTag value="已过期" text={i18n.t("instance.expired").toString()} />
                        </Row>
                    </Row>
                    <Column flex class={"fixTable"}>
                        <el-table data={this.data} width="100%" height="100%" v-loading={this.loading} on-selection-change={this.onSelectionChange}>
                            <el-table-column type="selection" width="45" />
                            <el-table-column prop="address" label={this.$t("instance.host").toString()} width="110" />
                            <el-table-column label={this.$t("instance.indexs").toString()} formatter={this.renderVm} />
                            <el-table-column label={this.$t("instance.action").toString()} width={i18n.locale == "zh" ? 200 : 270} formatter={this.renderAction} align="center" />
                        </el-table>
                    </Column>
                </Column>
            </div>
        );
    }

    protected onSelectionChange(e: HostInfo[]) {     
        this.checkList.clear();
        e.forEach(x => {
            for (let i = 1; i <= 12; i++) {
                var str = `${x.address}-${i}`;
                if (!this.checkList.includes(str)) this.checkList.push(str);
            }
        });       
    }

    private renderVm(row: HostInfo) {
        return (
            <Row gap={8} class={[s.selects, s.mini]} style={{ "flex-wrap": "wrap" }}>
                {Array.from({ length: 12 }, (_, index) => (
                    <el-checkbox v-model={this.checkList} class={this.getColor(row, index)} label={`${row.address}-${index + 1}`}>{this.$t("instance.instance").toString()}{index + 1}</el-checkbox>
                ))}
            </Row>
        );
    }

    private getColor(r: HostInfo, index: number) {
        let arr: RentalInfo[] = this.record.find(x => x.device_id == r.device_id)?.device_indexes || [];
        let obj = arr.find(x => x.index == index + 1);
        if (!obj) {
            return s.expired;//s.free;// "no_instance";       
        } else {
            return s[obj.state!];
        }
    }


    protected async changeSDK(row: HostInfo) {
        await this.$dialog(SwitchSDKDialog).show(row.address);
    }

    protected showDetail(r: HostInfo) {
        this.$dialog(InstancesDetailDialog).show({ host: r, rentals: this.record.find(x => x.device_id == r.device_id)?.device_indexes || [] });
    }

    protected showHostDetail(r: HostInfo) {
        this.$dialog(HostDetailDialog).show(r);
    }

    private renderAction(row: HostInfo) {
        return (
            <Row gap={8}>
                <MyButton size="mini" type="primary" text={this.$t("instance.hostDetail").toString()} onClick={() => this.showHostDetail(row)} />
                <MyButton size="mini" type="primary" text={this.$t("instance.detail").toString()} onClick={() => this.showDetail(row)} />
                {/* <MyButton size="mini" type="primary" text={this.$t("instance.switchSDK").toString()} onClick={() => this.changeSDK(row)} /> */}

            </Row>
        );
    }
}