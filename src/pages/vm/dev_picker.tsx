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
import { getPrefixName, getSuffixName } from '@/common/common';
import { RenameDialog } from './dialog/rename';
import { ITreeData, MyTree } from '@/lib/tree';

@Component
export class DevicePicker extends tsx.Component<IProps> {
    @Ref() private treeRef!: ElTree<any, any>;
    @InjectReactive() private selectedDevices!: DeviceInfo[];
    @InjectReactive() private selectedHosts!: HostInfo[];
    @InjectReactive() private hosts!: HostInfo[];
    @InjectReactive() private leftChecked!: string[];

    private loading = false;
    private data: any[] = [];
    private data2: ITreeData[] = [];
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
                children: item.devices?.filter(t => t.state == this.filterState || this.filterState == "all").map(v => {
                    return {
                        label: `${(v.index).toString().padStart(2, "0")}`,
                        key: v.key,
                        value: v
                    };
                }).sort((a, b) => a.value.index - b.value.index) ?? []
            };
        });
        this.loading = false;
        this.setChecked();
    };

    public setChecked(checked?: string[]) {
        var tmp = checked ?? this.leftChecked;
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
            this.leftChecked.push(...JSON.parse(str) as string[] || []);
        }
        this.data2 = [
            {
                label: "1",
                opened: true,
                selected: false,
                key: "1",
                children: [
                    {
                        label: "1-1",
                        opened: true,
                        selected: true,
                        key: "1-1",
                    },
                    {
                        label: "1-2",
                        opened: true,
                        selected: false,
                        key: "1-2",
                    },
                ]
            },
            {
                label: "2",
                opened: true,
                selected: false,
                key: "2",
                children: [
                    {
                        label: "2-1",
                        opened: true,
                        selected: false,
                        key: "2-1",
                    },
                ]
            },
        ];
    }

    @ErrorProxy({ loading: i18n.t("loading") })
    private async createVms(h: HostInfo) {
        var std = await orderApi.getRental(h.device_id);
        if (std.length < 1) {
            this.$alert(this.$t("create.maxCreate").toString(), this.$t("error").toString(), { type: "error" });
            return;
        }
        const createdCount = (new Set(h.devices.map(e => e.index))).size;
        var maxCanCreate = Math.max(0, std.first.device_indexes.filter(x => x.state != "expired").length - createdCount);
        if (maxCanCreate < 1) {
            this.$alert(this.$t("create.maxCreate").toString(), this.$t("error").toString(), { type: "error" });
            return;
        }
        this.$dialog(BatchCreateDialog).show({
            maxNum: maxCanCreate,
            hostIp: [h.address],
            obj: { name: "", num: 1, suffix_name: localStorage.getItem("suffix_name") || "deep", }
        }).then(async re => {
            var list = await deviceApi.getAllDevices();
            this.hosts.clear();
            this.hosts.push(...list);
        });
    }

    private async rename(v: DeviceInfo) {
        const re = await this.$dialog(RenameDialog).show(v);
        if (re) {
            v.name = re;
        }
    }

    private async updateVM(v: DeviceInfo) {
        var re = await this.$dialog(CreateDialog).show({
            isUpdate: true,
            info: v,
            hostId: v.hostId,
            obj: { name: getSuffixName(v.name) }
        });
        if (re) {
            if (re.name != getSuffixName(v.name)) {
                this.leftChecked.remove(v.key!);
                this.leftChecked.push(`${v.hostIp}-${v.index}-${getPrefixName(v.name)}${re.name}`);
            }

            var host = this.hosts.find(x => x.address == v.hostIp);
            if (host) {
                var arr = await deviceApi.getDeviceListByHost(host);
                host.devices.clear();
                host.devices.push(...arr);
            }
        }
    }

    @ErrorProxy({ confirm: i18n.t("confirm.deleteTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    private async deleteVM(v: DeviceInfo) {
        await deviceApi.delete(v.hostIp, v.name);
        this.leftChecked.remove(v.key!);
        this.selectedDevices.removeWhere(x => x.key == v.key);
        var host = this.hosts.find(x => x.address == v.hostIp);
        if (host) {
            var arr = await deviceApi.getDeviceListByHost(host);
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
                        <el-tag type={scope.data.value.has_error ? "danger" : ""}> {scope.data.value.has_error ? <i class="el-icon-warning"></i> : scope.data.children.length} </el-tag>
                    </Row>
                    <div class="autohide" onClick={(e) => {
                        this.createVms(scope.data.value);
                        e.stopPropagation();
                    }}><i class="el-icon-circle-plus-outline"></i></div>
                </Row>}
                {!scope.data.children && <Row gap={10} style={{ "flex": 1 }} mainAlign='space-between' crossAlign='center' class={scope.data.value.state !== "running" ? s.no_run : ""}>
                    <Row gap={3} style={{ "flex": 1 }}>
                        <span>{scope.data.label}</span>
                        <span style="font-size:13px" class={s.name_label}>{getSuffixName(scope.data.value.name)}</span>
                    </Row>
                    <Row>
                        <div class="autohide" onClick={(e) => {
                            this.rename(scope.data.value);
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
                <div class={s.treeBox}>
                    <el-tree
                        style={{ display: "none" }}
                        ref="treeRef"
                        v-loading={this.loading}
                        class={s.tree}
                        node-key="key"
                        data={this.data}
                        show-checkbox
                        empty-text={this.$t("common.empty")}
                        render-content={this.renderContent}
                        on-check-change={this.handleCheckChange} />
                    <MyTree data={this.data2} showCheckbox scopedSlots={{
                        renderContent: this.renderContent2
                    }} />
                </div>
                <el-divider />
                <el-radio-group v-model={this.filterState}>
                    <Row mainAlign='space-around'>
                        <el-radio label="running">{this.$t("filter.running")}</el-radio>
                        <el-radio label="all">{this.$t("filter.all")}</el-radio>
                    </Row>
                </el-radio-group>
            </Column>
        );
    }

    private renderContent2(item: ITreeData) {
        return <div>{item.label}asdf</div>;
    }
}

interface IProps {

}