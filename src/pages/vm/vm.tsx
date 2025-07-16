import { Column, Row } from "@/lib/container";
import Vue from "vue";
import { Component, ProvideReactive, Ref, Watch } from "vue-property-decorator";
import { DevicePicker } from "./dev_picker";
import { MyButton } from "@/lib/my_button";
import { DeviceList } from "./dev_list";
import { deviceApi } from "@/api/device_api";
import { ErrorProxy } from "@/lib/error_handle";
import { i18n } from "@/i18n/i18n";
import { DeviceInfo, HostInfo, ImageInfo } from "@/api/device_define";
import { ChangeImageDialog } from "./dialog/change_image";
import { Screenshot } from "./screenshot";
import { WebCastPlugin } from "@/lib/webcast/webcast";
import { ImportVmDialog } from "./dialog/import_vm";
import { Config } from "@/common/Config";
import { UploadFileDialog } from "./dialog/upload_file";

@Component
export default class VMPage extends Vue {
    @ProvideReactive() protected selectedDevices: DeviceInfo[] = [];
    @ProvideReactive() protected selectedRows: DeviceInfo[] = [];
    @ProvideReactive() protected selectedHosts: HostInfo[] = [];
    @ProvideReactive() protected rightChecked: string[] = [];
    @ProvideReactive() protected leftChecked: string[] = [];
    @ProvideReactive() protected hosts: HostInfo[] = [];
    @ProvideReactive() protected view: string = localStorage.getItem("view") || "list";
    @ProvideReactive() protected images: ImageInfo[] = [];
    @Ref() private list!: DeviceList;

    private imgRefreshTimer: any;
    // private refreshTimer: any;

    protected batchOperateName: string = "";
    protected refreshDuration: number = 5;
    // private dialogShowed: boolean = false;

    protected async created() {
        this.refreshHost();
        // this.refreshTimer = setInterval(() => !this.dialogShowed && this.refreshHost(), 5000);
        this.refreshDuration = parseInt(localStorage.getItem("refreshDuration") || "5");
        // this.$root.$on("dialogShow", () => this.dialogShowed = true);
        // this.$root.$on("dialogClose", () => this.dialogShowed = false);
        this.refreshImages();
    }

    protected async refreshImages() {
        try {
            this.images = await deviceApi.getImages(Config.host);
        } catch (error) {
            console.warn(`刷新镜像列表失败: ${error}`);
        }
    }

    protected async refreshHost() {
        try {
            this.hosts = await deviceApi.getAllDevices();
        } catch (error) {
            this.$message.error(`${error}`);
            //this.$alert(`${error}`, this.$t("error").toString(), { type: "error" });
            this.hosts = [];
        }
    }

    protected destroyed() {
        // this.$root.$off("dialogShow");
        // this.$root.$off("dialogClose");
        if (this.imgRefreshTimer) clearInterval(this.imgRefreshTimer);
        // if (this.refreshTimer) clearInterval(this.refreshTimer);
    }

    protected async refresh() {
        var group = this.selectedItems.groupBy(e => e.hostIp);
        for (var key in group) {
            this.list.refresh(key, group[key][0].hostId);
        }
    }

    private updateImg() {
        Screenshot.refresh();
    }

    @Watch("selectedDevices")
    protected selectedDevicesChange() {
        if (this.view !== "list") this.updateImg();
    }

    @Watch("view")
    protected viewChange() {
        if (this.view == "list") {
            if (this.imgRefreshTimer) clearInterval(this.imgRefreshTimer);
            this.imgRefreshTimer = null;
        } else {
            if (!this.imgRefreshTimer) this.imgRefreshTimer = setInterval(() => this.updateImg(), this.refreshDuration * 1000);
            this.updateImg();
        }
        localStorage.setItem("view", this.view);
    }
    @Watch("refreshDuration")
    protected refreshDurationChange() {
        if (this.imgRefreshTimer) clearInterval(this.imgRefreshTimer);
        if (this.view != "list") this.imgRefreshTimer = setInterval(() => this.updateImg(), this.refreshDuration * 1000);
        localStorage.setItem("refreshDuration", this.refreshDuration.toString());
    }

    private get selectedItems(): DeviceInfo[] {
        var arr: DeviceInfo[] = [];
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

    protected async batchOperate(callback: (data: DeviceInfo) => Promise<void>, operate: string) {
        this.batchOperateName = i18n.t(`batch.${operate}`).toString();
        var arr = this.selectedItems;
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

    @ErrorProxy({ confirm: (self) => self.batchOperateName, success: i18n.t("batch.success"), loading: i18n.t("loading") })

    protected async batchOperateIng(arr: DeviceInfo[], callback: (data: DeviceInfo) => Promise<void>) {
        var tasks: Promise<void>[] = [];

        arr.forEach(e => {
            tasks.push(callback(e));
        });
        await Promise.all(tasks);
        await this.refresh();
    }

    private async batchUpload() {
        var re = await this.$dialog(UploadFileDialog).show(this.selectedItems);
        console.log(re);
        if (re) await this.refresh();
    }

    private async batchChangeImage() {
        var re = await this.$dialog(ChangeImageDialog).show(this.selectedItems);
        if (re) await this.refresh();
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

    private async importVm() {
        var re = await this.$dialog(ImportVmDialog).show(this.hosts);
        if (re) await this.refreshHost();
    }

    protected render() {
        return (
            <Row crossAlign="stretch" flex gap={15}>
                <DevicePicker />
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
                            <el-radio-group v-model={this.view}>
                                <el-radio-button label="list">{this.$t("list")}</el-radio-button>
                                <el-radio-button label="vertical" >{this.$t("vertical")}</el-radio-button>
                                <el-radio-button label="horizontal" >{this.$t("horizontal")}</el-radio-button>
                            </el-radio-group>

                            {this.view != "list" && <el-dropdown>
                                <el-button type="primary">
                                    {`${i18n.t("refreshDuration", { 0: this.refreshDuration })}`}<i class="el-icon-arrow-down el-icon--right"></i>
                                </el-button>
                                <el-dropdown-menu slot="dropdown">
                                    <el-dropdown-item nativeOnClick={() => this.refreshDuration = 1}>1 {i18n.t("second")}</el-dropdown-item>
                                    <el-dropdown-item nativeOnClick={() => this.refreshDuration = 3}>3 {i18n.t("second")}</el-dropdown-item>
                                    <el-dropdown-item nativeOnClick={() => this.refreshDuration = 5}>5 {i18n.t("second")}</el-dropdown-item>
                                    <el-dropdown-item nativeOnClick={() => this.refreshDuration = 10}>10 {i18n.t("second")}</el-dropdown-item>
                                </el-dropdown-menu>
                            </el-dropdown>}
                        </Row>
                        <Row gap={8} crossAlign="center">
                            <MyButton type="primary" text={this.$t("import.btn")} onClick={this.importVm} />
                            <MyButton type="primary" text={this.$t("remoteControl")} onClick={this.remoteControl} />
                        </Row>
                    </Row>
                    <DeviceList ref="list" />
                    {/* onSelectChange={this.currSelectedDevicesChange}  */}
                </Column >
            </Row >
        );
    }

    private async remoteControl() {
        WebCastPlugin.startCast(this);
    }

}