import { deviceApi } from '@/api/device_api';
import { DeviceInfo, HostInfo } from '@/api/device_define';
import { getSuffixName, makeVmApiUrl } from '@/common/common';
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
import { SelectFileUploadDialog } from './dialog/select_file_upload';
import { VmDetailDialog } from './dialog/vm_detail';
import { Screenshot } from './screenshot';

@Component
export class DeviceList extends tsx.Component<IProps, IEvents> {
    @InjectReactive() private selectedDevices!: DeviceInfo[];
    @InjectReactive() private leftChecked!: string[];
    @InjectReactive() private rightChecked!: string[];
    @InjectReactive() private hosts!: HostInfo[];
    @InjectReactive() private view!: string;
    @Ref() private tb!: ElTable;
    private data: DeviceInfo[] = [];

    protected async created() {
    }

    public selectAll() {
        if (this.view == "list") {
            this.tb.toggleAllSelection();
        } else {
            if (this.rightChecked.length == this.data.length) {
                this.rightChecked.clear();
            } else {
                this.rightChecked.clear();
                this.rightChecked.push(...this.data.map(e => e.key!));
            }
        }
        this.$emit("selectChange", this.rightChecked);
    }

    @Watch("view")
    protected viewChange() {
        if (this.view == "list") {
            this.toggleRowSelection();
        }
    }

    private toggleRowSelection() {
        var tmp = [...this.rightChecked];// [...this.selectedRows];
        this.$nextTick(() => {
            // console.log(this.data, tmp);
            this.data.forEach(x => {
                var t = (tmp.find(y => x.key == y) != null);
                //console.log("设置选中项", x, t);
                this.tb?.toggleRowSelection(x, t);
            });
        });
    }

    @Watch("selectedDevices", { deep: true })
    public async selectedDevicesChange() {
        // console.log("selectedDevices change :" + this.selectedDevices.length);
        //this.data.removeWhere(x => this.selectedDevices.find(t => t.key == x.key) == null);
        this.data = this.selectedDevices.map(x => x);
        this.toggleRowSelection();
        //    .forEach(x => {
        //         var index = this.data.findIndex(a => a.key == x.key);
        //         if (index > -1) {
        //             this.data[index] = x;
        //         } else {
        //             this.data.push(x);
        //         }
        //     });
        // this.data = this.selectedDevices.map(item => {
        //     return { ...item };
        // });
    }


    private handleSelectionChange(selectedRows: any[], e: any) {
        if (this.data.length > 0) {
            this.rightChecked.clear();
            this.rightChecked.push(...selectedRows.map(e => e.key));
            this.$emit("selectChange", this.rightChecked);
        }

    }

    @ErrorProxy()
    public async refresh(hostIp: string, hostId: string) {

        var re = await deviceApi.getDeviceListByIp(hostIp, hostId);
        re.sort((a, b) => a.index - b.index);
        this.hosts.find(t => t.address == hostIp)!.devices = [...re];
        this.selectedDevices.removeWhere(x => re.find(t => t.key == x.key) == null);
        re.forEach(x => {
            var index = this.selectedDevices.findIndex(t => t.key == x.key);
            if (index > -1) {
                this.selectedDevices.splice(index, 1, x);
            }
        });
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
            return <el-tag type="info">{this.$t(r.state).toString()}</el-tag>;
        }
    }

    protected renderStatus2(r: DeviceInfo) {
        return <span class={[s.status, r.state == "running" ? s.running : s.no_run]} title={this.$t(r.state == "running" ? "running" : "noRun").toString()}> </span>;
    }

    protected render() {
        return (
            <div class={[s.deviceList, "contentBox"]}>
                {this.view == "list" && <div class={s.table}>
                    <el-table default-expand-all data={this.data} width="100%" height="100%" row-key="key"
                        ref="tb" on-selection-change={(e, e2) => this.handleSelectionChange(e, e2)} empty-text={this.$t("table.emptyText")}>
                        <el-table-column type="selection" width="45" reserve-selection={true} />
                        <el-table-column prop="index" label={this.$t("table.index")} width="80" align="center" />
                        <el-table-column prop="name" label={this.$t("name")} formatter={r => getSuffixName(r.name)} show-overflow-tooltip />
                        <el-table-column prop="ip" label="IP" width="130" formatter={(r) => r.state == "running" ? r.ip : ""} />
                        {/* <el-table-column prop="imgVer" label={this.$t("systemVersion")} width="120" /> */}
                        <el-table-column prop="adb" label="ADB" />
                        <el-table-column prop="created_at" label={this.$t("createdAt")} width="150" />
                        <el-table-column prop="state" label={this.$t("state")} width="90" formatter={this.renderStatus} align="center" />
                        <el-table-column label={this.$t("action")} width="120" formatter={this.renderAction} />
                    </el-table>
                </div>}
                {(this.view == "horizontal" || this.view == "vertical") &&
                    <el-checkbox-group value={this.rightChecked}>
                        <div class={s[this.view]}>
                            {
                                this.data.map(e => {
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
            obj: { name: name, sandbox_size: 16 },
        });
        if (re) await this.refresh(data.hostIp, data.hostId);
    }

    private async updateVm(data: DeviceInfo) {
        var re = await this.$dialog(CreateDialog).show({
            isUpdate: true,
            info: data,
            hostId: data.hostId,
            obj: Object.assign({ name: getSuffixName(data.name) }, data.create_req),
        });
        if (re) await this.refresh(data.hostIp, data.hostId);
    }

    @ErrorProxy({ confirm: i18n.t("confirm.rebootTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    public async reboot(data: DeviceInfo) {
        await deviceApi.reboot(data.hostIp, data.name);
        await this.refresh(data.hostIp, data.hostId);
    }

    @ErrorProxy({ confirm: i18n.t("confirm.resetTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    private async reset(data: DeviceInfo) {
        await deviceApi.reset(data.hostIp, data.name);
        await this.refresh(data.hostIp, data.hostId);
    }

    @ErrorProxy({ confirm: i18n.t("confirm.shutdownTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    private async shutdown(data: DeviceInfo) {
        await deviceApi.shutdown(data.hostIp, data.name);
        await this.refresh(data.hostIp, data.hostId);
    }

    @ErrorProxy({ confirm: i18n.t("confirm.startTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    private async start(data: DeviceInfo) {
        await deviceApi.start(data.hostIp, data.name);
        await this.refresh(data.hostIp, data.hostId);
    }

    @ErrorProxy({ confirm: i18n.t("confirm.deleteTitle"), success: i18n.t("success"), loading: i18n.t("loading") })
    private async delete(data: DeviceInfo) {
        await deviceApi.delete(data.hostIp, data.name);
        await this.refresh(data.hostIp, data.hostId);
    }

    private async rename(data: DeviceInfo) {
        var re = await this.$dialog(RenameDialog).show(data);
        if (re) {
            var index = this.rightChecked.findIndex(x => x == data.key);
            if (index > -1) {
                this.rightChecked.removeWhere(x => x == data.key);
                this.rightChecked.push(`${data.hostIp}-${data.index}-${re}`);
            }
            this.leftChecked.removeWhere(x => x == data.key);
            this.leftChecked.push(`${data.hostIp}-${data.index}-${re}`);
            await this.refresh(data.hostIp, data.hostId);

        }
    }

    private async fileBrowser(data: DeviceInfo) {
        await this.$dialog(FilelistDialog).show(data);
    }
    private apiDoc(data: DeviceInfo) {
        window.open(`http://${data.hostIp}/api`);
    }
    private async changeModel(data: DeviceInfo) {
        var re = await this.$dialog(ChangeModelDialog).show(data);
        if (re) await this.refresh(data.hostIp, data.hostId);
    }
    private async setS5Proxy(data: DeviceInfo) {
        var re = await this.$dialog(S5setDialog).show([data]);
        await this.refresh(data.hostIp, data.hostId);

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
        await this.$dialog(CloneVmDialog).show(data);
        this.refresh(data.hostIp, data.hostId);
    }

    private async selectFile(data: DeviceInfo) {
        await this.$dialog(SelectFileUploadDialog).show(data);
    }

    @ErrorProxy({ success: i18n.t("upload.success") })
    protected async upload(data: DeviceInfo, file: File) {
        await deviceApi.upload(data.hostIp, data.name, `/sdcard/${file.name}`, file);
    }

    private renderAction(row: DeviceInfo, hasBtn: boolean = true) {
        const renderBtn = () => {
            switch (row.state) {
                case 'running':
                    return <TextButton text={this.$t("stop")} onClick={() => this.shutdown(row)} />;
                case 'stopped':
                case 'exited':
                case 'created':
                    return <TextButton text={this.$t("start")} onClick={() => this.start(row)} />;
            }
            return <TextButton text={this.$t("createVm")} onClick={() => this.create(row)} />;
        };
        return (
            <Row gap={10} crossAlign='center'>
                {hasBtn && renderBtn()}
                {row.state !== '' && <el-dropdown>

                    <TextButton text={this.$t("more")} />
                    <el-dropdown-menu slot="dropdown">
                        <el-dropdown-item nativeOnClick={() => this.start(row)}>{this.$t("start")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.create(row)}>{this.$t("createVm")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.reboot(row)}>{this.$t("menu.reboot")}</el-dropdown-item>
                        <el-dropdown-item nativeOnClick={() => this.reset(row)}>{this.$t("menu.reset")}</el-dropdown-item>
                        <el-dropdown-item disabled={row.state != 'running'} nativeOnClick={() => this.shutdown(row)}>{this.$t("menu.shutdown")}</el-dropdown-item>
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


