import { deviceApi } from '@/api/device_api';
import { DeviceInfo, HostInfo, MyConfig, MyTreeNode, TreeConfig, } from '@/api/device_define';
import { orderApi } from '@/api/order_api';
import { filterWithConfig, getPrefixName, getSuffixName } from '@/common/common';
import { i18n } from '@/i18n/i18n';
import { Column, Row } from '@/lib/container';
import { ErrorProxy } from '@/lib/error_handle';
import { ITreeSlotProps, MyTree } from "@/lib/tree";
import { Component, InjectReactive, Watch } from 'vue-property-decorator';
import * as tsx from 'vue-tsx-support';
import s from './dev_picker.module.less';
import { BatchCreateDialog } from './dialog/batch_create';
import { CreateDialog } from './dialog/create';
import { DiscoverDialog } from './dialog/discover';
import { RenameDialog } from './dialog/rename';
import { RemarkDialog } from './dialog/remark';
import { HostDetailDialog } from "@/pages/instance/dialog/host_detail_new";
import { Icon } from '@iconify/vue2';
import hardDiskRounded from '@iconify-icons/material-symbols/hard-drive';
import usbPlugFill from '@iconify-icons/bi/usb-plug-fill';
import chip from '@iconify-icons/mdi/chip';
import serverNetwork from '@iconify-icons/mdi/server-network';
import harddisk from '@iconify-icons/mdi/harddisk';

@Component
export class DevicePicker extends tsx.Component<IProps, IEvents> {
    @InjectReactive() private hosts!: HostInfo[];
    @InjectReactive() private treeConfig!: TreeConfig[];
    @InjectReactive() protected hostTree!: MyTreeNode[];
    @InjectReactive() protected config!: MyConfig;

    private loading = true;

    @Watch("config", { deep: true })
    protected filterChange(newValue: string, oldValue: string) {
        // console.log("config_change");
        localStorage.setItem("config", JSON.stringify(this.config));
    }

    private childrenFilter(item: MyTreeNode) {
        return item.children ? true : filterWithConfig(this.config, item.value);
    }

    @Watch("hosts", { deep: true })
    protected hostChange() {
        // console.log("host change");
        this.loading = false;
    };

    private get visibleDevices() {
        if (!this.hostTree) return [];
        return this.hostTree.flatMap(h => {
            return h.children ? h.children.filter(c => filterWithConfig(this.config, c.value)) : [];
        });
    }

    private get isAllSelected() {
        const devices = this.visibleDevices;
        if (devices.length === 0) return false;
        return devices.every(d => d.selected);
    }

    private get isIndeterminate() {
        const devices = this.visibleDevices;
        if (devices.length === 0) return false;
        const selectedCount = devices.filter(d => d.selected).length;
        return selectedCount > 0 && selectedCount < devices.length;
    }

    private toggleSelectAll(val: boolean) {
        this.visibleDevices.forEach(d => d.selected = val);
        this.onTreeChange();
    }

    protected async created() {
        this.loading = true;
    }

    @ErrorProxy({ loading: i18n.t("loading") })
    private async createVms(h: HostInfo) {
        var std = await orderApi.getRental(h.device_id);
        const showPurchaseConfirm = () => {
            this.$confirm(
                "当前主机无可用实例位，请前往购买",
                i18n.t("error") as string,
                {
                    confirmButtonText: "前往购买",
                    cancelButtonText: i18n.t("confirm.cancel") as string,
                    type: "error"
                }
            ).then(() => {
                this.$router.push("/instance");
            }).catch(() => { });
        };

        if (std.length < 1) {
            showPurchaseConfirm();
            return;
        }

        var rentalIndexSet = std.first.device_indexes.filter(x => x.state != "expired").map(x => x.index);
        var set = new Set(
            h.devices
                .filter(e => rentalIndexSet.includes(e.index))  // O(1) 判断
                .map(e => e.index)
        );
        //const createdCount = set.size;
        var maxCanCreate = Math.max(0, rentalIndexSet.length);
        if (maxCanCreate < 1) {
            showPurchaseConfirm();
            return;
        }
        console.log(this.config);
        this.$dialog(BatchCreateDialog).show({
            maxNum: maxCanCreate,
            hostIp: [h.address],
            obj: {
                name: "", num: 1,
                sandbox: 1,
                sandbox_size: 64,
                suffix_name: this.config.suffixName || "deep",
                width: 720,
                height: 1280,
                dpi: 320,
                fps: 24,
            }
        }).then(async re => {
            this.$emit('changed', h.address);
        });
    }

    private async rename(v: DeviceInfo) {
        const re = await this.$dialog(RenameDialog).show(v);
        if (re) {
            v.name = re;
        }
    }

    private async showDiscoverDialog() {
        const result = await this.$dialog(DiscoverDialog).show();
        if (result) {
            this.$emit('changed');
        }
    }

    private async remark(v: HostInfo) {
        const re = await this.$dialog(RemarkDialog).show(v);
        if (re != undefined) {
            // 找到 hostTree 对应节点
            const node = this.hostTree.find(x => x.label.startsWith(v.address));
            if (node) {
                // Vue.set 保证响应式
                this.$set(node.value, "remark", re);
                node.label = v.address;
            }
        }
    }

    private async updateVM(v: DeviceInfo) {
        var re = await this.$dialog(CreateDialog).show({
            isUpdate: true,
            info: v,
            hostId: v.hostId,
            obj: { name: getSuffixName(v.name), sandbox: 1 }
        });
        if (re) {
            if (re.name != getSuffixName(v.name)) {
                var tc = this.treeConfig.find(x => x.key == v.key);
                if (tc) tc.key = `${v.hostIp}-${v.index}-${getPrefixName(v.name)}${re.name}`;
            }
            this.$emit('changed', v.hostIp);
        }
    }

    protected showHostDetail(r: HostInfo) {
        this.$dialog(HostDetailDialog).show(r);
    }

    private getDiskIcon(disk: string) {
        if (!disk) return "";
        const d = disk.toLowerCase();
        if (d.includes("nvme")) return hardDiskRounded;
        if (d.includes("usb")) return usbPlugFill;
        if (d.includes("emmc")) return chip;
        if (d.includes("iscsi")) return serverNetwork;
        return harddisk;
    }

    @ErrorProxy({ loading: i18n.t("loading") })
    private async deleteVM(v: DeviceInfo) {
        const n1 = Math.floor(Math.random() * 10) + 1;
        const n2 = Math.floor(Math.random() * 10) + 1;
        const confirmText = t("confirm.deleteTitle")(this, v);
        try {
            await this.$prompt(`<div>${confirmText}</div><div style="color: red; margin-top: 10px; font-weight: bold;">${i18n.t("confirm.mathQuestion", [n1, n2])}</div>`, i18n.t("confirm.title") as string, {
                dangerouslyUseHTMLString: true,
                confirmButtonText: i18n.t("confirm.ok") as string,
                cancelButtonText: i18n.t("confirm.cancel") as string,
                inputPattern: new RegExp(`^${n1 + n2}$`),
                inputErrorMessage: i18n.t("confirm.calcError") as string
            });
        } catch (e) {
            return;
        }

        await deviceApi.delete(v.hostIp, v.name);
        this.treeConfig.removeWhere(x => x.key == v.key);
        this.$emit('changed', v.hostIp);
        this.$message.success(i18n.t("success") as string);
    }

    protected renderContent(obj: ITreeSlotProps<MyTreeNode>) {
        const data = obj.item;
        const children = obj.children;
        return (
            <Row gap={10} crossAlign='center' class="row" style={{ "flex": 1 }} mainAlign='center'>
                {children && <Row crossAlign='center' mainAlign='space-between' style={{ "flex": 1 }}>
                    <Row gap={5} crossAlign='center'>
                        <span style={'display: flex; align-items: center'} onClick={(e) => {
                            e.stopPropagation();
                            this.showHostDetail(data.value);
                        }}>
                            {data.value.disk && <el-tooltip content={data.value.disk} placement="top" effect="light" open-delay={1000} transition="">
                                <span><Icon icon={this.getDiskIcon(data.value.disk)} style={{ verticalAlign: "middle", fontSize: "16px", marginLeft: "-3px" }} /></span>
                            </el-tooltip>}
                            {data.label}{data.value.remark && data.value.remark != "" ? "(" + data.value.remark + ")" : ""}</span>
                        <el-tag type={data.value.has_error ? "danger" : ""}> {data.value.has_error ? <i class="el-icon-warning"></i> : children.length} </el-tag>
                    </Row>
                    <Row>
                        <div class="autohide" onClick={(e) => {
                            this.remark(data.value);
                            e.stopPropagation();
                        }}><i class="el-icon-edit-outline"></i></div>
                        <div class="autohide" onClick={(e) => {
                            this.createVms(data.value);
                            e.stopPropagation();
                        }}><i class="el-icon-circle-plus-outline"></i></div>
                    </Row>

                </Row>}
                {!children && <Row gap={10} style={{ "flex": 1 }} mainAlign='space-between' crossAlign='center' class={data.value.state !== "running" ? s.no_run : ""}>
                    <Row gap={3} style={{ "flex": 1 }} crossAlign='center'>
                        <span class={s.vmNums}>{data.label}{data.value.remark && data.value.remark != "" ? "(" + data.value.remark + ")" : ""}</span>
                        <span style="font-size:13px" class={s.name_label} title={getSuffixName(data.value.name)}>{getSuffixName(data.value.name)}</span>
                    </Row>
                    <Row>
                        <div class="autohide" onClick={(e) => {
                            this.rename(data.value);
                            e.stopPropagation();
                        }}><i class="el-icon-edit-outline"></i></div>
                        <div class="autohide" onClick={(e) => {
                            this.deleteVM(data.value);
                            e.stopPropagation();
                        }}><i class="el-icon-delete"></i></div>
                    </Row>
                </Row>
                }
            </Row>
        );
    }


    private onTreeChange() {
        this.treeConfig.clear();

        this.hostTree.forEach(x => {
            this.treeConfig.push({ key: x.key, selected: x.selected, opened: x.opened });
            this.treeConfig.push.apply(this.treeConfig, x.children!.map(y => {
                return ({ key: y.key, selected: y.selected, opened: y.opened });
            }));
        });
        localStorage.setItem("TreeConfig", JSON.stringify(this.treeConfig));
        //this.treeConfig = re;
    }

    protected render() {
        return (
            <Column width={300} class={[s.DevicePicker, "contentBox"]}>
                <Row gap={5} crossAlign="center" style="margin-bottom: 10px;">
                    <el-checkbox value={this.isAllSelected} indeterminate={this.isIndeterminate} onChange={this.toggleSelectAll}></el-checkbox>
                    <el-input style="flex: 1; margin-bottom: 0;" prefix-icon="el-icon-search" v-model={this.config.filterNameOrIp} placeholder={this.$t("filterNameOrIp", { 0: this.hosts.length }) as string} clearable>
                    </el-input>
                    <el-button icon="el-icon-plus" type="text" onClick={() => this.showDiscoverDialog()}></el-button>
                </Row>
                <div class={s.treeBox} v-loading={this.loading}>
                    <div class={s.tree}>
                        <MyTree data={this.hostTree} on-change={this.onTreeChange}
                            childrenFilter={this.childrenFilter}
                            showCheckbox scopedSlots={{
                                renderContent: this.renderContent
                            }} />
                    </div>
                </div>
                <el-divider />
                <el-radio-group v-model={this.config.filterState}>
                    <Row mainAlign='space-around'>
                        <el-radio label="running">{this.$t("filter.running")} ({this.hosts.reduce((a, b) => a + b.devices.filter(d => d.state === "running").length, 0)})</el-radio>
                        <el-radio label="all">{this.$t("filter.all")} ({this.hosts.reduce((a, b) => a + b.devices.length, 0)})</el-radio>
                    </Row>
                </el-radio-group>
            </Column>
        );
    }
}

interface IProps {

}

interface IEvents {
    onChanged(hostIp: string): void;
}

function t(t: string) {
    return function (self: DevicePicker, data: DeviceInfo) {
        return i18n.t(t, {
            0: `${data.hostIp}`,
            1: `${data.index}`,
            2: `${getSuffixName(data.name)}`,
        });
    };
}
