import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { i18n } from "@/i18n/i18n";
import { sleep } from "@/common/common";
import { HostInfo, DiskItem, IscsiInfo } from "@/api/device_define";
import { MyButton } from "@/lib/my_button";
import { Icon } from '@iconify/vue2';


@Dialog
export class SwitchDiskDialog extends CommonDialog<HostInfo, boolean> {
    public override width: string = "600px";

    protected disks: DiskItem[] = [];
    protected currentDisk = "";
    protected form = {
        disk: "",   // 选中的磁盘
        iscsi_ip: "",
        iscsi_port: 3260,
        iscsi_username: "",
        iscsi_password: "",
        iscsi_target: "",
        iscsi_lun: 0,
    };

    public override async show(data: HostInfo) {
        this.title = this.$t("vmDetail.switchDisk").toString();
        this.data = data;

        // ⭐ 打开对话框时获取磁盘信息
        const res = await deviceApi.getDisks(data.address);
        this.disks = res.list;
        this.currentDisk = res.current_disk;
        this.form.disk = res.current_disk;

        if (res.iscsi_info) {
            this.form.iscsi_ip = res.iscsi_info.ip;
            this.form.iscsi_port = res.iscsi_info.port;
            this.form.iscsi_username = res.iscsi_info.username;
            this.form.iscsi_password = res.iscsi_info.password;
            this.form.iscsi_target = res.iscsi_info.target;
            this.form.iscsi_lun = res.iscsi_info.lun;
        }

        return super.show(data);
    }

    @ErrorProxy({ success: i18n.t("instance.switchSDKSuccess"), loading: i18n.t("loading") })
    protected override async onConfirm() {
        if (this.form.disk === this.currentDisk && this.form.disk !== "iscsi") {
            this.close(false);
            return;
        }

        let iscsiInfo: IscsiInfo | undefined;
        if (this.form.disk === 'iscsi') {
            iscsiInfo = {
                ip: this.form.iscsi_ip,
                port: this.form.iscsi_port,
                username: this.form.iscsi_username,
                password: this.form.iscsi_password,
                target: this.form.iscsi_target,
                lun: this.form.iscsi_lun
            };
        }

        await deviceApi.switchDisk(this.data.address, this.form.disk, iscsiInfo);

        //检测是否切换成功
        for (var i = 0; i < 10; i++) {
            await sleep(1000);
            try {
                await deviceApi.getDeviceListByHost(this.data);
                break;
            } catch (e) {
                console.log(e);
            }
        }

        this.close(true);
    }

    private get formRules() {
        return {
            iscsi_ip: [
                { required: true, message: i18n.t("notNull"), trigger: "blur" }
            ],
            iscsi_port: [
                { required: true, message: i18n.t("notNull"), trigger: "blur" }
            ],
            iscsi_target: [
                { required: true, message: i18n.t("notNull"), trigger: "blur" }
            ],
            iscsi_lun: [
                { required: true, message: i18n.t("notNull"), trigger: "blur" },
                { type: 'number', min: 0, message: "Lun >= 0", trigger: 'blur' }
            ],
        };
    }

    @ErrorProxy({ confirm: i18n.t("vmDetail.formatDiskConfirm"), success: i18n.t("vmDetail.formatDiskSuccess"), loading: i18n.t("loading") })
    private async formatDisk() {
        await deviceApi.formatDisk(this.data.address);
    }

    private getDiskIcon(disk: string) {
        if (!disk) return "";
        const d = disk.toLowerCase();
        if (d.includes("nvme")) return "material-symbols:hard-disk-rounded";
        if (d.includes("usb")) return "bi:usb-plug-fill";
        if (d.includes("emmc")) return "mdi:chip";
        if (d.includes("iscsi")) return "mdi:server-network";
        return "mdi:harddisk";
    }

    protected renderDialog(): VNode {
        return (
            <div style={{ padding: "20px" }}>
                <div style={{ marginBottom: "20px" }}>
                    <el-radio-group v-model={this.form.disk}>
                        {this.disks.map(disk => (
                            <el-radio
                                key={disk.name}
                                label={disk.name}
                                disabled={!disk.enabled}
                            >
                                <Icon icon={this.getDiskIcon(disk.name)} style={{ marginRight: "5px", verticalAlign: "middle" }} />
                                {disk.name}
                                {disk.name === this.currentDisk ? (
                                    <span style={{ color: "#999", marginLeft: "0px" }}>
                                        （{this.$t("vmDetail.currentDisk")}）
                                    </span>
                                ) : null}
                            </el-radio>
                        ))}
                    </el-radio-group>
                </div>

                {this.form.disk === 'iscsi' ? (
                    <el-form
                        label-position="left"
                        label-width="120px"
                        props={{ model: this.form }}
                        rules={this.formRules}
                    >
                        <el-form-item label={this.$t("vmDetail.iscsi.ip")} prop="iscsi_ip">
                            <el-input v-model={this.form.iscsi_ip} />
                        </el-form-item>
                        <el-form-item label={this.$t("vmDetail.iscsi.port")} prop="iscsi_port">
                            <el-input v-model={this.form.iscsi_port} type="number" onInput={(v: string) => this.form.iscsi_port = Number(v)} />
                        </el-form-item>
                        <el-form-item label={this.$t("vmDetail.iscsi.username")} prop="iscsi_username">
                            <el-input v-model={this.form.iscsi_username} />
                        </el-form-item>
                        <el-form-item label={this.$t("vmDetail.iscsi.password")} prop="iscsi_password">
                            <el-input type="password" v-model={this.form.iscsi_password} show-password />
                        </el-form-item>
                        <el-form-item label={this.$t("vmDetail.iscsi.target")} prop="iscsi_target">
                            <el-input v-model={this.form.iscsi_target} />
                        </el-form-item>
                        <el-form-item label={this.$t("vmDetail.iscsi.lun")} prop="iscsi_lun">
                            <el-input v-model={this.form.iscsi_lun} type="number" min="0" onInput={(v: string) => this.form.iscsi_lun = Number(v)} />
                        </el-form-item>
                    </el-form>
                ) : null}

                <div
                    style={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "flex-start",
                        marginTop: "10px"
                    }}
                >
                    <MyButton
                        type="primary"
                        size="small"
                        style={{ whiteSpace: "nowrap" }}
                        onClick={this.formatDisk}
                    >
                        {this.$t("vmDetail.formatDisk")}
                    </MyButton>
                </div>
            </div>
        );
    }

}
