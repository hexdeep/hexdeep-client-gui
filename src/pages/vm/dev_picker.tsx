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
import { RenameDialog } from './dialog/rename';
import { RemarkDialog } from './dialog/remark';

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

    protected async created() {
        this.loading = true;
    }

    @ErrorProxy({ loading: i18n.t("loading") })
    private async createVms(h: HostInfo) {
        console.log("asdf");
        var std = await orderApi.getRental(h.device_id);
        if (std.length < 1) {
            this.$alert(this.$t("create.maxCreate").toString(), this.$t("error").toString(), { type: "error" });
            return;
        }

        var rentalIndexSet = std.first.device_indexes.filter(x => x.state != "expired").map(x => x.index);
        var set = new Set(
            h.devices
                .filter(e => rentalIndexSet.includes(e.index))  // O(1) 判断
                .map(e => e.index)
        );
        const createdCount = set.size;
        var maxCanCreate = Math.max(0, rentalIndexSet.length - createdCount);
        if (maxCanCreate < 1) {
            this.$alert(this.$t("create.maxCreate").toString(), this.$t("error").toString(), { type: "error" });
            return;
        }
        console.log(this.config);
        this.$dialog(BatchCreateDialog).show({
            maxNum: maxCanCreate,
            hostIp: [h.address],
            obj: {
                name: "", num: 1,
                sandbox: 1,
                sandbox_size: 16,
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

    @ErrorProxy({ confirm: t("confirm.deleteTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    private async deleteVM(v: DeviceInfo) {
        await deviceApi.delete(v.hostIp, v.name);
        this.treeConfig.removeWhere(x => x.key == v.key);
        this.$emit('changed', v.hostIp);
    }

    protected renderContent(obj: ITreeSlotProps<MyTreeNode>) {
        const data = obj.item;
        const children = obj.children;
        return (
            <Row gap={10} crossAlign='center' class="row" style={{ "flex": 1 }} mainAlign='center'>
                {children && <Row crossAlign='center' mainAlign='space-between' style={{ "flex": 1 }}>
                    <Row gap={5} crossAlign='center'>
                        <span>{data.label}{data.value.remark && data.value.remark != "" ? "(" + data.value.remark + ")" : ""}</span>
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
                        <span class={s.vmNums}>{data.label}</span>
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
            <Column width={290} class={[s.DevicePicker, "contentBox"]}>
                <el-input prefix-icon="el-icon-search" v-model={this.config.filterNameOrIp} placeholder={this.$t("filterNameOrIp")} clearable />
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