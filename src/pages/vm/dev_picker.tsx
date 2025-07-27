import { deviceApi } from '@/api/device_api';
import { Column, Row } from '@/lib/container';
import { Component, InjectReactive, Watch } from 'vue-property-decorator';
import * as tsx from 'vue-tsx-support';
import s from './dev_picker.module.less';
import { DeviceInfo, HostInfo, MyConfig, MyTreeNode, TreeConfig, } from '@/api/device_define';
import { BatchCreateDialog } from './dialog/batch_create';
import { CreateDialog } from './dialog/create';
import { i18n } from '@/i18n/i18n';
import { ErrorProxy } from '@/lib/error_handle';
import { orderApi } from '@/api/order_api';
import { getPrefixName, getSuffixName } from '@/common/common';
import { RenameDialog } from './dialog/rename';
import { MyTree } from "@/lib/tree";

@Component
export class DevicePicker extends tsx.Component<IProps> {
    @InjectReactive() private hosts!: HostInfo[];
    @InjectReactive() private treeConfig!: TreeConfig[];
    @InjectReactive() protected hostTree!: MyTreeNode[];
    @InjectReactive() protected config!: MyConfig;

    private loading = true;


    @Watch("config", { deep: true })
    protected filterChange(newValue: string, oldValue: string) {
        console.log("config_change");
        localStorage.setItem("config", JSON.stringify(this.config));
    }

    private childrenFilter(item: MyTreeNode) {
        return item.children ? true : item.value.state == this.config.filterState || this.config.filterState == "all";
    }

    @Watch("hosts", { deep: true })
    private hostChange() {
        console.log("host change");
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
        const createdCount = (new Set(h.devices.map(e => e.index))).size;
        var maxCanCreate = Math.max(0, std.first.device_indexes.filter(x => x.state != "expired").length - createdCount);
        if (maxCanCreate < 1) {
            this.$alert(this.$t("create.maxCreate").toString(), this.$t("error").toString(), { type: "error" });
            return;
        }
        console.log(this.config);
        this.$dialog(BatchCreateDialog).show({
            maxNum: maxCanCreate,
            hostIp: [h.address],
            obj: { name: "", num: 1, suffix_name: this.config.suffixName || "deep", }
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

    private async updateVM(v: DeviceInfo) {
        var re = await this.$dialog(CreateDialog).show({
            isUpdate: true,
            info: v,
            hostId: v.hostId,
            obj: { name: getSuffixName(v.name) }
        });
        if (re) {
            if (re.name != getSuffixName(v.name)) {
                var tc = this.treeConfig.find(x => x.key == v.key);
                if (tc) tc.key = `${v.hostIp}-${v.index}-${getPrefixName(v.name)}${re.name}`;
            }
            this.$emit('changed', v.hostIp);
        }
    }

    @ErrorProxy({ confirm: i18n.t("confirm.deleteTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    private async deleteVM(v: DeviceInfo) {
        await deviceApi.delete(v.hostIp, v.name);
        this.treeConfig.removeWhere(x => x.key == v.key);
        this.$emit('changed', v.hostIp);
    }

    protected renderContent(data: MyTreeNode) {
        return (
            <Row gap={10} crossAlign='center' class="row" style={{ "flex": 1 }} mainAlign='center'>
                {data.children && <Row crossAlign='center' mainAlign='space-between' style={{ "flex": 1 }}>
                    <Row gap={5} crossAlign='center'>
                        <span>{data.label}</span>
                        <el-tag type={data.value.has_error ? "danger" : ""}> {data.value.has_error ? <i class="el-icon-warning"></i> : data.children.length} </el-tag>
                    </Row>
                    <div class="autohide" onClick={(e) => {
                        this.createVms(data.value);
                        e.stopPropagation();
                    }}><i class="el-icon-circle-plus-outline"></i></div>
                </Row>}
                {!data.children && <Row gap={10} style={{ "flex": 1 }} mainAlign='space-between' crossAlign='center' class={data.value.state !== "running" ? s.no_run : ""}>
                    <Row gap={3} style={{ "flex": 1 }}>
                        <span>{data.label}</span>
                        <span style="font-size:13px" class={s.name_label}>{getSuffixName(data.value.name)}</span>
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
            <Column width={240} class={[s.DevicePicker, "contentBox"]}>
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