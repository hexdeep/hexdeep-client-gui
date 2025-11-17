import { deviceApi } from "@/api/device_api";
import { DeviceInfo, HostInfo, ImageInfo, MyConfig, MyTreeNode, TreeConfig } from "@/api/device_define";
import { Config } from "@/common/Config";
import { i18n } from "@/i18n/i18n";
import { Column, Row } from "@/lib/container";
import { ErrorProxy } from "@/lib/error_handle";
import { MyButton } from "@/lib/my_button";
import { WebCastPlugin } from "@/lib/webcast/webcast";
import Vue from "vue";
import { Component, ProvideReactive, Ref, Watch } from "vue-property-decorator";
import { DeviceList } from "./dev_list";
import { DevicePicker } from "./dev_picker";
import { ChangeImageDialog } from "./dialog/change_image";
import { ImportVmDialog } from "./dialog/import_vm";
import { UploadFileDialog } from "./dialog/upload_file";
import { Screenshot } from "./screenshot";
import s from './vm.module.less';


@Component
export default class VMPage extends Vue {
    @ProvideReactive() protected hostTree: MyTreeNode[] = [];
    @ProvideReactive() protected selectedDevices: DeviceInfo[] = [];
    @ProvideReactive() protected rightChecked: string[] = [];
    @ProvideReactive() protected treeConfig: TreeConfig[] = [];
    @ProvideReactive() protected hosts: HostInfo[] = [];
    @ProvideReactive() protected config: MyConfig = {
        view: "list",
        refreshDuration: 5,
        filterState: "all",
        suffixName: "deep",
        filterNameOrIp: ""
    };
    @ProvideReactive() protected images: ImageInfo[] = [];
    @Ref() private list!: DeviceList;
    @Ref() private devicePicker!: DevicePicker;

    private imgRefreshTimer: any;
    protected batchOperateName: string = "";

    protected async created() {
        try {
            this.config = JSON.parse(localStorage.getItem("config") || "");
        } catch (ex) {
            console.log(ex);
        }
        await this.refreshImages();
        this.refreshHost();
    }

    protected async refreshImages() {
        try {
            const cacheFun = async () => {
                this.images = await deviceApi.getImages(Config.host);
                sessionStorage.setItem("imagesCache", JSON.stringify(this.images));
            };
            let cache = this.loadImageCache();
            if (cache) {
                this.images = cache;
                cacheFun();
            } else {
                await cacheFun();
            }
        } catch (error) {
            console.warn(`刷新镜像列表失败: ${error}`);
        }
    }

    private loadImageCache() {
        try {
            let cache = sessionStorage.getItem("imagesCache");
            if (cache) {
                return JSON.parse(cache) as ImageInfo[];
            }
        } catch (error) {
            // ignore
        }
        return;
    }

    protected async refreshHost(ip?: string) {
        let curr: HostInfo | undefined;
        try {
            if (!ip) {
                this.hosts = await deviceApi.getAllDevices();
            } else {
                curr = this.hosts.find(x => x.address == ip);
                if (curr) {
                    curr.devices = await deviceApi.getDeviceListByHost(curr);
                    curr.remark = await deviceApi.getHostRemark(curr.address);
                } else {
                    this.hosts = await deviceApi.getAllDevices();
                }
            }

            this.FillTree(curr);

        } catch (error) {
            this.$message.error(`${error}`);
            this.hosts = [];
        }
    }

    private getSavedChecked() {
        let str = localStorage.getItem("TreeConfig") || "";
        if (str) {
            try {
                return JSON.parse(str) as TreeConfig[] ?? [];
            } catch (error) {
                return [];
            }
        }
        return [];
    }

    private FillTree(host?: HostInfo) {
        this.treeConfig = this.getSavedChecked();
        let arr: HostInfo[] = [];
        if (!host) {
            arr = this.hosts;
            this.hostTree.removeWhere(x => !this.hosts.contains(t => t.address == x.label));
        } else {
            arr = [host!];
        }
        arr.forEach(x => {
            let node = this.hostTree.find(t => t.label == x.address);
            let tc = this.treeConfig.find(t => t.key == x.address);
            if (node) {
                node.value = x;
            } else {
                node = {
                    label: x.remark && x.remark != "" ? x.address + "(" + x.remark + ")" : x.address,
                    value: x,
                    key: x.address,
                    opened: false,
                    selected: false,
                    children: []
                };
                this.hostTree.push(node);
            }
            if (tc) {
                node.opened = tc.opened;
                node.selected = tc.selected;
            }
            node.children!.removeWhere(a => !x.devices.contains(t => t.key == a.key));
            x.devices.forEach(y => {
                let child = node!.children!.find(t => t.key == y.key);
                let ctc = this.treeConfig.find(t => t.key == y.key);
                if (child) {
                    child.value = y;
                } else {
                    child = {
                        label: `${(y.index).toString().padStart(2, "0")}`,
                        value: y,
                        key: y.key!,
                        opened: false,
                        selected: true,
                    };
                    node!.children!.push(child);
                }
                if (ctc) child.selected = ctc.selected;
            });
            node.children?.sort((a, b) => a.value.index - b.value.index);
        });
    }

    protected destroyed() {
        if (this.imgRefreshTimer) clearInterval(this.imgRefreshTimer);
    }

    private updateImg() {
        Screenshot.refresh();
    }

    @Watch("selectedDevices")
    protected selectedDevicesChange() {
        if (this.config.view !== "list") this.updateImg();
    }

    @Watch("config", { deep: true })
    protected viewChange() {
        if (this.config.view == "list") {
            if (this.imgRefreshTimer) clearInterval(this.imgRefreshTimer);
            this.imgRefreshTimer = null;
        } else {
            if (this.imgRefreshTimer) clearInterval(this.imgRefreshTimer);
            this.imgRefreshTimer = setInterval(() => this.updateImg(), this.config.refreshDuration * 1000);
            this.updateImg();
        }
    }

    private get selectedItems(): DeviceInfo[] {
        let arr: DeviceInfo[] = [];
        this.hosts.forEach(x => {
            x.devices.forEach(y => {
                if (this.rightChecked.find(a => a == y.key) != null) arr.push(y);
            });
        });
        return arr;
    }

    private selectAll() {
        this.list.selectAll();
    }

    protected async batchOperate(callback: (data: DeviceInfo) => Promise<any>, operate: string) {
        this.batchOperateName = i18n.t(`batch.${operate}`).toString();
        let arr = this.selectedItems;
        switch (operate) {
            case "start":
                arr = arr.filter(x => x.state != "running").groupByToMap(t => `${t.hostIp}_${t.index}`).entries().map(([k, v]) => v[0]).toArray();
                break;
            case "reboot":
            case "shutdown":
                arr = arr.filter(x => x.state == "running");
                break;
            case "delete":
            case "reset":
                //arr = this.selectedDevices;
                break;
        }

        await this.batchOperateIng(arr, callback);
    }

    @ErrorProxy({ confirm: (self, _1, _2) => self.batchOperateName, success: i18n.t("batch.success"), loading: i18n.t("loading") })
    protected async batchOperateIng(arr: DeviceInfo[], callback: (data: DeviceInfo) => Promise<void>) {
        let tasks: Promise<void>[] = [];

        arr.forEach(e => {
            tasks.push(callback(e));
        });
        await Promise.allSettled(tasks).catch(e => {
            console.log(e);
        });
        this.refreshHost();
    }

    private async batchUpload() {
        let re = await this.$dialog(UploadFileDialog).show(this.selectedItems);
        // if (re)  this.refreshHost();
    }

    private async batchChangeImage() {
        let re = await this.$dialog(ChangeImageDialog).show(this.selectedItems);
        if (re) this.refreshHost();
    }

    // private async batchCreate() {
    //     await this.$dialog(BatchCreateDialog).show({
    //         num: 12,
    //         pre_name: "hexdeep",
    //         hostIp: this.selectedItems.groupByToMap(x => x.hostIp).keys().toArray(),
    //         obj: { name: "" }
    //     });
    //     await this.refresh();
    // }
    private onHostChanged(ip: string | undefined) {
        this.refreshHost(ip);
    }
    private async importVm() {
        let re = await this.$dialog(ImportVmDialog).show(this.hosts);
        if (re) await this.refreshHost();
    }

    protected render() {
        return (
            <Row crossAlign="stretch" flex gap={15} class={s.body}>
                <DevicePicker ref="devicePicker" onChanged={this.onHostChanged} />
                <Column flex gap={13}>
                    <Row class={"contentBox"}>
                        <Row flex gap={8}>
                            <MyButton type="primary" text={this.$t("selectAll")} onClick={() => this.selectAll()} />
                            <el-dropdown  >
                                <MyButton plain text={this.$t("batchOperations")} />
                                <el-dropdown-menu slot="dropdown">
                                    {/* <el-dropdown-item disabled={this.selectedItems.isEmpty} nativeOnClick={this.batchCreate}>{this.$t("createVm")}</el-dropdown-item> */}
                                    <el-dropdown-item disabled={this.rightChecked.isEmpty} nativeOnClick={() => this.batchOperate(async row => {
                                        if (row.state != "running") await deviceApi.start(row.hostIp, row.name);
                                    }, "start")}>{this.$t("menu.start")}</el-dropdown-item>
                                    <el-dropdown-item disabled={this.rightChecked.isEmpty} nativeOnClick={() => this.batchOperate(row => deviceApi.shutdown(row.hostIp, row.name), "shutdown")}>{this.$t("menu.shutdown")}</el-dropdown-item>
                                    <el-dropdown-item disabled={this.rightChecked.isEmpty} nativeOnClick={() => this.batchOperate(row => deviceApi.reboot(row.hostIp, row.name), "reboot")}>{this.$t("menu.reboot")}</el-dropdown-item>
                                    <el-dropdown-item disabled={this.rightChecked.isEmpty} nativeOnClick={() => this.batchOperate(row => deviceApi.reset(row.hostIp, row.name), "reset")}>{this.$t("menu.reset")}</el-dropdown-item>
                                    <el-dropdown-item disabled={this.rightChecked.isEmpty} nativeOnClick={() => this.batchOperate(row => deviceApi.delete(row.hostIp, row.name), "delete")}>{this.$t("menu.delete")}</el-dropdown-item>
                                    <el-dropdown-item disabled={this.rightChecked.isEmpty} nativeOnClick={this.batchChangeImage}>{this.$t("menu.changeImage")}</el-dropdown-item>
                                    <el-dropdown-item disabled={this.rightChecked.isEmpty} nativeOnClick={this.batchUpload}>{this.$t("menu.upload")}</el-dropdown-item>
                                </el-dropdown-menu>
                            </el-dropdown>
                            <el-radio-group v-model={this.config.view}>
                                <el-radio-button label="list">{this.$t("list")}</el-radio-button>
                                <el-radio-button label="vertical" >{this.$t("vertical")}</el-radio-button>
                                <el-radio-button label="horizontal" >{this.$t("horizontal")}</el-radio-button>
                            </el-radio-group>

                            {this.config.view != "list" && <el-dropdown>
                                <el-button type="primary">
                                    {`${i18n.t("refreshDuration", { 0: this.config.refreshDuration })}`}<i class="el-icon-arrow-down el-icon--right"></i>
                                </el-button>
                                <el-dropdown-menu slot="dropdown">
                                    <el-dropdown-item nativeOnClick={() => this.config.refreshDuration = 1}>1 {i18n.t("second")}</el-dropdown-item>
                                    <el-dropdown-item nativeOnClick={() => this.config.refreshDuration = 3}>3 {i18n.t("second")}</el-dropdown-item>
                                    <el-dropdown-item nativeOnClick={() => this.config.refreshDuration = 5}>5 {i18n.t("second")}</el-dropdown-item>
                                    <el-dropdown-item nativeOnClick={() => this.config.refreshDuration = 10}>10 {i18n.t("second")}</el-dropdown-item>
                                </el-dropdown-menu>
                            </el-dropdown>}
                        </Row>
                        <Row gap={8} crossAlign="center">
                            <MyButton type="primary" text={this.$t("import.btn")} onClick={this.importVm} />
                            <MyButton type="primary" text={this.$t("remoteControl")} onClick={this.remoteControl} />
                        </Row>
                    </Row>
                    <DeviceList ref="list" onChanged={this.onHostChanged} />
                </Column >
            </Row >
        );
    }

    private async remoteControl() {
        WebCastPlugin.startCast(this);
    }

}