import { deviceApi } from '@/api/device_api';
import { DeviceInfo, HostInfo, ImageInfo, MyConfig, MyTreeNode, TreeConfig } from '@/api/device_define';
import { getPrefixName, getSuffixName, makeVmApiUrl } from '@/common/common';
import { i18n } from '@/i18n/i18n';
import { Column, Row } from '@/lib/container';
import { ErrorProxy } from '@/lib/error_handle';
import { TextButton } from '@/lib/my_button';
import { ElTable } from 'element-ui/types/table';
import { Component, InjectReactive, Ref, Watch } from 'vue-property-decorator';
import * as tsx from 'vue-tsx-support';
import s from './dev_list.module.less';
import { ChangeModelDialog } from './dialog/change_model';
import { CloneVmDialog } from './dialog/clone_vm';
import { CreateDialog } from './dialog/create';
import { FilelistDialog } from './dialog/filelist';
import { RenameDialog } from './dialog/rename';
import { S5setDialog } from './dialog/s5set';
import { UploadFileDialog } from './dialog/upload_file';
import { VmDetailDialog } from './dialog/vm_detail';
import { Screenshot } from './screenshot';
import { ModelSelectotDialog } from '@/lib/component/model_selector';
import { waapi } from 'animejs';

@Component
export class DeviceList extends tsx.Component<IProps, IEvents> {
    @InjectReactive() protected hostTree!: MyTreeNode[];
    @InjectReactive() private selectedDevices!: DeviceInfo[];
    @InjectReactive() private treeConfig!: TreeConfig[];
    @InjectReactive() private rightChecked!: string[];
    @InjectReactive() private hosts!: HostInfo[];
    @InjectReactive() private config!: MyConfig;
    @InjectReactive() private images!: ImageInfo[];
    @Ref() private tb!: ElTable;

    private get data2(): DeviceInfo[] {
        var re = this.hostTree.flatMap(x => x.children?.filter(y => y.selected && (y.value.state == this.config.filterState || this.config.filterState == "all")).map(t => t.value));
        this.fillGitCommitId(re);
        return re;
    }

    protected async created() {
    }

    private async fillGitCommitId(devices: DeviceInfo[]) {
        devices.forEach(async (device) => {
            if (device.state != "running") {
                return;
            }

            if (!device.macvlan) {
                deviceApi.getContainerGitCommitId(device.hostIp, device.name).then((gitCommitId: string) => {
                    this.$set(device, 'git_commit_id', gitCommitId);
                });
            } else {
                deviceApi.getContainerGitCommitIdMacvlan(device.android_sdk).then((gitCommitId: string) => {
                    this.$set(device, 'git_commit_id', gitCommitId);
                });
            }
        });
    }

    public selectAll() {
        if (this.config.view == "list") {
            this.tb.toggleAllSelection();
        } else {
            if (this.rightChecked.length == this.data2.length) {
                this.rightChecked.clear();
            } else {
                this.rightChecked.clear();
                this.rightChecked.push(...this.data2.map(e => e.key!));
            }
        }
        this.$emit("selectChange", this.rightChecked);
    }

    @Watch("config")
    protected viewChange() {
        if (this.config.view == "list") {
            this.toggleRowSelection();
        }
    }

    private toggleRowSelection() {
        var tmp = [...this.rightChecked];
        this.$nextTick(() => {
            // console.log(this.data, tmp);
            this.data2.forEach(x => {
                var t = (tmp.find(y => x.key == y) != null);
                //console.log("设置选中项", x, t);
                this.tb?.toggleRowSelection(x, t);
            });
        });
    }

    @Watch("selectedDevices", { deep: true })
    public async selectedDevicesChange() {
        this.toggleRowSelection();
    }


    private handleSelectionChange(selectedRows: any[], e: any) {
        if (this.data2.length > 0) {
            this.rightChecked.clear();
            this.rightChecked.push(...selectedRows.map(e => e.key));
            this.$emit("selectChange", this.rightChecked);
        }
    }

    private checkboxChanged(e: boolean, e2: DeviceInfo) {
        if (!e) {
            this.rightChecked.removeWhere(x => x == e2.key);
        } else {
            this.rightChecked.push(e2.key!);
        }
    }

    protected renderStatus(r: DeviceInfo) {
        if (r.state == "running") {
            return <el-tag type="success">{this.$t(r.state).toString()}</el-tag>;
        } else {
            return <el-tag type="danger">{this.$t(r.state).toString()}</el-tag>;
        }
    }

    protected renderStatus2(r: DeviceInfo) {
        return <span class={[s.status, r.state == "running" ? s.running : s.no_run]} title={this.$t(r.state == "running" ? "running" : "noRun").toString()}> </span>;
    }

    private renderVmImage(r: DeviceInfo) {
        var img = this.images.find(x => x.address == r.image_addr);
        if (img) {
            return img.name;
        }
        return r.image_addr;
    }

    protected render() {
        return (
            <div class={[s.deviceList, "contentBox"]}>
                {this.config.view == "list" && <div class={s.table}>
                    <el-table default-expand-all data={this.data2} width="100%" height="100%" row-key="key"
                        ref="tb" on-selection-change={(e, e2) => this.handleSelectionChange(e, e2)} empty-text={this.$t("table.emptyText")}>
                        <el-table-column type="selection" width="45" reserve-selection={true} />
                        <el-table-column prop="index" label={this.$t("table.index")} width="60" align="center" />
                        <el-table-column prop="name" label={this.$t("name")} width="100" formatter={r => getSuffixName(r.name)} show-overflow-tooltip />
                        {/* <el-table-column prop="ip" label="IP" width="130" formatter={(r) => r.state == "running" ? r.ip : ""} /> */}
                        {/* <el-table-column prop="imgVer" label={this.$t("systemVersion")} width="120" /> */}
                        <el-table-column prop="adb" label="ADB" width="160" show-overflow-tooltip />
                        <el-table-column prop="git_commit_id" label={this.$t("vmDetail.containerGitCommitId")} width="100" show-overflow-tooltip />
                        <el-table-column prop="image_addr" label={this.$t("vmImage")} show-overflow-tooltip formatter={this.renderVmImage} />
                        <el-table-column prop="state" label={this.$t("state")} width="90" formatter={this.renderStatus} align="center" />
                        <el-table-column label={this.$t("action")} width="120" formatter={this.renderAction} />
                    </el-table>
                </div>}
                {(this.config.view == "horizontal" || this.config.view == "vertical") &&
                    <el-checkbox-group value={this.rightChecked}>
                        <div class={s[this.config.view]}>
                            {
                                this.data2.map(e => {
                                    return <Column key={`parent_${e.key}`} class={[s.img_box, e.state == "running" ? s.running : s.no_run]}>
                                        <Screenshot data-key={e.key} key={e.key} device={e} />
                                        <Row mainAlign='space-between' crossAlign='center'>
                                            <el-checkbox class={s.checkbox} label={e.key} onChange={(c, event) => this.checkboxChanged(c, e)} >
                                                <Row gap={5} flex crossAlign='center'>
                                                    <span>{`${e.index}`}</span>
                                                    <span class={["ellipsis", s.checkbox_label]}>{`${getSuffixName(e.name)}`}</span>
                                                </Row>
                                            </el-checkbox>
                                            {this.renderAction(e, false)}
                                        </Row>
                                    </Column>;
                                })
                            }
                        </div>
                    </el-checkbox-group>
                }
            </div>
        );
    }

    protected renderMenu(e: DeviceInfo) {

    }

    public async create(data: DeviceInfo) {
        let name = getSuffixName(data.name);
        let index = name.match(/\d+$/);
        console.log(index);
        if (index) {
            name = name.replace(index[0], (parseInt(index[0]) + 1) + "");
        } else {
            name += "2";
        }
        let re = await this.$dialog(CreateDialog).show({
            hostId: data.hostId,
            info: data,
            obj: {
                name: name,
                sandbox_size: 16,
                width: 720,
                height: 1280,
                dpi: 320,
                fps: 24,
            },
        });
        if (re) this.$emit("changed", data.hostIp);
    }

    private async updateVm(data: DeviceInfo) {
        var re = await this.$dialog(CreateDialog).show({
            isUpdate: true,
            info: data,
            hostId: data.hostId,
            obj: Object.assign({ name: getSuffixName(data.name) }, data.create_req),
        });
        if (re) {
            if (re.name != getSuffixName(data.name)) {
                var t = this.treeConfig.find(x => x.key == data.key);
                if (t) {
                    t.key = `${data.hostIp}-${data.index}-${getPrefixName(data.name)}${re.name}`;
                    localStorage.setItem("TreeConfig", JSON.stringify(this.treeConfig));
                }
            }
            this.$emit("changed", data.hostIp);
        }
    }

    @ErrorProxy({ confirm: i18n.t("confirm.rebootTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    public async reboot(data: DeviceInfo) {
        await deviceApi.reboot(data.hostIp, data.name);
        this.$emit("changed", data.hostIp);
    }

    @ErrorProxy({ confirm: i18n.t("confirm.resetTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    private async reset(data: DeviceInfo) {
        await deviceApi.reset(data.hostIp, data.name);
        this.$emit("changed", data.hostIp);
    }

    @ErrorProxy({ confirm: i18n.t("confirm.shutdownTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    private async shutdown(data: DeviceInfo) {
        await deviceApi.shutdown(data.hostIp, data.name);
        this.$emit("changed", data.hostIp);
    }

    @ErrorProxy({ confirm: i18n.t("confirm.startTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    private async start(data: DeviceInfo) {
        await deviceApi.start(data.hostIp, data.name);
        this.$emit("changed", data.hostIp);
    }

    @ErrorProxy({ confirm: i18n.t("confirm.deleteTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    private async delete(data: DeviceInfo) {
        await deviceApi.delete(data.hostIp, data.name);
        this.treeConfig.removeWhere(x => x.key == data.key);
        localStorage.setItem("TreeConfig", JSON.stringify(this.treeConfig));
        this.$emit("changed", data.hostIp);
    }

    private async rename(data: DeviceInfo) {
        var re = await this.$dialog(RenameDialog).show(data);
        if (re) {
            var index = this.rightChecked.findIndex(x => x == data.key);
            if (index > -1) {
                this.rightChecked.removeWhere(x => x == data.key);
                this.rightChecked.push(`${data.hostIp}-${data.index}-${re}`);
            }
            var t = this.treeConfig.find(x => x.key == data.key);
            if (t) {
                t.key = `${data.hostIp}-${data.index}-${re}`;
                localStorage.setItem("TreeConfig", JSON.stringify(this.treeConfig));
            }
            this.$emit("changed", data.hostIp);
        }
    }

    private async fileBrowser(data: DeviceInfo) {
        await this.$dialog(FilelistDialog).show(data);
    }
    private apiDoc(data: DeviceInfo) {
        window.open(`http://${data.hostIp}/api`);
    }
    private async changeModel(data: DeviceInfo) {
        var dialog = this.$dialog(ModelSelectotDialog);
        dialog.immediateSubmit = true;
        dialog.device = data;
        await dialog.show();
    }
    private async setS5Proxy(data: DeviceInfo) {
        var re = await this.$dialog(S5setDialog).show([data]);
        if (re) this.$emit("changed", data.hostIp);

    }
    private async hostDetails(data: DeviceInfo) {
        await this.$dialog(VmDetailDialog).show(data);
    }

    @ErrorProxy({ confirm: i18n.t("confirm.backupTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    private async backupVm(data: DeviceInfo) {
        let url = await deviceApi.exportDocker(data.hostIp, data.name);
        let link = makeVmApiUrl("host/download", data.hostIp) + `?path=${url}`;
        location.href = link;
    }

    private async cloneVm(data: DeviceInfo) {
        let re = await this.$dialog(CloneVmDialog).show(data);
        if (re) this.$emit("changed", data.hostIp);
    }

    private async androidSdkApi(data: DeviceInfo) {
        window.open("http://" + data.android_sdk, "_blank");
    }

    private async selectFile(data: DeviceInfo) {
        await this.$dialog(UploadFileDialog).show([data]);

    }

    @ErrorProxy({ success: i18n.t("upload.success") })
    protected async upload(data: DeviceInfo, file: File) {
        await deviceApi.upload(data.hostIp, data.name, `/sdcard/${file.name}`, file);
    }

    private renderAction(row: DeviceInfo, hasBtn: boolean = true) {
        const renderBtn = () => {
            switch (row.state) {
                case 'running':
                    return <TextButton text={this.$t("menu.shutdown")} onClick={() => this.shutdown(row)} />;
                case 'stopped':
                case 'exited':
                case 'created':
                    return <TextButton text={this.$t("menu.start")} onClick={() => this.start(row)} />;
            }
            return <TextButton text={this.$t("createVm")} onClick={() => this.create(row)} />;
        };
        return (
            <Row gap={10} crossAlign='center'>
                {hasBtn && renderBtn()}
                {row.state !== '' && <el-dropdown>

                    <TextButton text={this.$t("more")} />
                    <el-dropdown-menu slot="dropdown">
                        <el-dropdown-item disabled={row.state == 'running'} nativeOnClick={() => this.start(row)}>{this.$t("menu.start")}</el-dropdown-item>
                        <el-dropdown-item disabled={row.state != 'running'} nativeOnClick={() => this.shutdown(row)}>{this.$t("menu.shutdown")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.reboot(row)}>{this.$t("menu.reboot")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.create(row)}>{this.$t("createVm")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.reset(row)}>{this.$t("menu.reset")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.delete(row)}>{this.$t("menu.delete")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.rename(row)}>{this.$t("menu.rename")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.updateVm(row)}>{this.$t("menu.updateVm")}</el-dropdown-item>
                        <el-dropdown-item disabled={row.state != 'running'} nativeOnClick={() => this.fileBrowser(row)}>{this.$t("menu.fileBrowser")}</el-dropdown-item>
                        <el-dropdown-item disabled={row.state != 'running'} nativeOnClick={() => this.selectFile(row)}>{this.$t("menu.upload")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.changeModel(row)}>{this.$t("menu.changeModel")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.setS5Proxy(row)}>{this.$t("menu.setS5Proxy")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.hostDetails(row)}>{this.$t("menu.hostDetails")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.backupVm(row)}>{this.$t("menu.backup")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.cloneVm(row)}>{this.$t("menu.clone")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.androidSdkApi(row)}>{this.$t("menu.androidSdkApi")}</el-dropdown-item>
                    </el-dropdown-menu>
                </el-dropdown>
                }

            </Row>
        );
    }
}

interface IProps {

}

interface IEvents {
    onSelectChange(selectedRows: DeviceInfo[]): void;
}


