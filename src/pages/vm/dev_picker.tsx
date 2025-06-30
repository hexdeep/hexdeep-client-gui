import { deviceApi } from '@/api/device_api';
import { Column, Row } from '@/lib/container';
import { ElTree } from 'element-ui/types/tree';
import { Component, InjectReactive, Ref, Watch } from 'vue-property-decorator';
import * as tsx from 'vue-tsx-support';
import s from './dev_picker.module.less';
import { DeviceInfo, HostInfo, } from '@/api/device_define';
import { BatchCreateDialog } from './dialog/batch_create';
import { CreateDialog } from './dialog/create';
import { i18n } from '@/i18n/i18n';
import { ErrorProxy } from '@/lib/error_handle';
import { orderApi } from '@/api/order_api';

@Component
export class DevicePicker extends tsx.Component<IProps> {
    @Ref() private treeRef!: ElTree<any, any>;
    @InjectReactive() private selectedDevices!: DeviceInfo[];
    @InjectReactive() private selectedHosts!: HostInfo[];
    @InjectReactive() private hosts!: HostInfo[];
    @InjectReactive() private leftChecked!: string[];

    private loading = false;
    private data: any[] = [];
    private filterState = localStorage.getItem("filterState") || "all";

    @Watch("filterState")
    protected filterChange(newValue: string, oldValue: string) {
        this.hostChange();
        this.$nextTick(() => {
            this.handleCheckChange();
        });
        localStorage.setItem("filterState", newValue);
    }

    @Watch("hosts", { deep: true })
    private hostChange() {
        console.log("host change");
        this.data = this.hosts.map(item => {
            return {
                label: item.address,
                value: item,
                key: item.address,
                children: item.devices.filter(t => t.state == this.filterState || this.filterState == "all").map(v => {
                    return {
                        label: `${(v.index).toString().padStart(2, "0")}`,
                        key: v.key,
                        value: v
                    };
                }).sort((a, b) => a.value.index - b.value.index)
            };
        });
        this.loading = false;
        this.setChecked();
    };

    private setChecked() {
        var tmp = [...this.leftChecked];
        this.$nextTick(() => {
            this.treeRef.setCheckedKeys(tmp);
        });
    }

    private handleCheckChange() {
        var checked = this.treeRef.getCheckedNodes();
        var nodes = checked.filter((item: any) => !item.children).map(e => e.value);
        this.leftChecked.clear();
        this.leftChecked.push(...checked.filter((item: any) => !item.children).map(e => e.key));
        localStorage.setItem("leftChecked", JSON.stringify(this.leftChecked));
        this.selectedDevices.clear();
        this.selectedDevices.push(...nodes);
        nodes = checked.filter((item: any) => item.children).map(e => e.value);
        this.selectedHosts.clear();
        this.selectedHosts.push(...nodes);
    }

    protected async created() {
        this.loading = true;
        var str = localStorage.getItem("leftChecked") || "";
        if (str) {
            this.leftChecked.clear();
            this.leftChecked.push(...JSON.parse(localStorage.getItem("leftChecked") || "") as string[] || []);
        }
    }

    private async createVms(h: HostInfo) {
        var std = await orderApi.getRental(h.device_id);
        if (std.length < 1) {
            this.$alert(this.$t("create.maxCreate").toString(), this.$t("error").toString(), { type: "error" });
            return;
        }
        const createdCount = (new Set(h.devices.map(e => e.index))).size;
        var maxCanCreate = Math.max(0, std.first.device_indexes.length - createdCount);
        if (maxCanCreate < 1) {
            this.$alert(this.$t("create.maxCreate").toString(), this.$t("error").toString(), { type: "error" });
            return;
        }
        var re = await this.$dialog(BatchCreateDialog).show({
            num: 1,
            maxNum: maxCanCreate,
            suffix_name: localStorage.getItem("suffix_name") || "deep",
            hostIp: [h.address],
            obj: { name: "" }
        });
        console.log(re);
        var list = await deviceApi.getAllDevices();
        this.hosts.clear();
        this.hosts.push(...list);
    }

    private async updateVM(v: DeviceInfo) {
        var re = this.$dialog(CreateDialog).show({
            isUpdate: true,
            info: v,
            obj: { name: v.name.last() }
        });
        var host = this.hosts.find(x => x.address == v.hostIp);
        if (host) {
            var arr = await deviceApi.getDeviceList(host.address);
            arr.forEach(x => x.hostIp = host!.address);
            host.devices.clear();
            host.devices.push(...arr);
        }
    }

    @ErrorProxy({ confirm: i18n.t("confirm.deleteTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    private async deleteVM(v: DeviceInfo) {
        await deviceApi.delete(v.hostIp, v.name);
        this.leftChecked.remove(v.key!);
        this.selectedDevices.removeWhere(x => x.key == v.key);
        var host = this.hosts.find(x => x.address == v.hostIp);
        if (host) {
            var arr = await deviceApi.getDeviceList(host.address);
            arr.forEach(x => x.hostIp = host!.address);
            host.devices.clear();
            host.devices.push(...arr);
        }
    }

    protected renderContent = (h: any, scope: any) => {
        return (
            <Row gap={10} crossAlign='center' class="row" style={{ "flex": 1 }} mainAlign='center'>
                {scope.data.children && <Row crossAlign='center' mainAlign='space-between' style={{ "flex": 1 }}>
                    <Row gap={5} crossAlign='center'>
                        <span>{scope.data.label}</span>
                        <el-tag> {scope.data.children.length} </el-tag>
                    </Row>
                    <div class="autohide" onClick={(e) => {
                        this.createVms(scope.data.value);
                        e.stopPropagation();
                    }}><i class="el-icon-circle-plus-outline"></i></div>
                </Row>}
                {!scope.data.children && <Row gap={10} style={{ "flex": 1 }} mainAlign='space-between' crossAlign='center' class={scope.data.value.state !== "running" ? s.no_run : ""}>
                    <Row gap={3} style={{ "flex": 1 }}>
                        <span>{scope.data.label}</span>
                        <span style="font-size:13px" class={s.name_label}>{scope.data.value.name.last()}</span>
                    </Row>
                    <Row>
                        <div class="autohide" onClick={(e) => {
                            this.updateVM(scope.data.value);
                            e.stopPropagation();
                        }}><i class="el-icon-edit-outline"></i></div>
                        <div class="autohide" onClick={(e) => {
                            this.deleteVM(scope.data.value);
                            e.stopPropagation();
                        }}><i class="el-icon-delete"></i></div>
                    </Row>
                </Row>
                }
            </Row>
        );
    };

    protected render() {
        return (
            <Column width={240} class={[s.DevicePicker, "contentBox"]}>
                <el-tree
                    ref="treeRef"
                    v-loading={this.loading}
                    class={s.tree}
                    style={{ height: '100%' }}
                    node-key="key"
                    data={this.data}
                    default-expand-all
                    show-checkbox
                    render-content={this.renderContent}
                    on-check-change={this.handleCheckChange} />
                <el-divider></el-divider>
                <el-radio-group v-model={this.filterState}>
                    <Row mainAlign='space-around'>
                        <el-radio label="running">{this.$t("filter.running")}</el-radio>
                        <el-radio label="all">{this.$t("filter.all")}</el-radio>
                    </Row>
                </el-radio-group>
            </Column>
        );
    }
}

interface IProps {

}