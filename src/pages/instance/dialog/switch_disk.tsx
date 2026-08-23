import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { i18n } from "@/i18n/i18n";
import { sleep } from "@/common/common";
import { HostInfo, DiskItem, IscsiInfo, IscsiLunInfo, IscsiTargetInfo, NbdInfo } from "@/api/device_define";
import { MyButton } from "@/lib/my_button";
import { Icon } from '@iconify/vue2';
import hardDiskRounded from '@iconify-icons/material-symbols/hard-drive';
import usbPlugFill from '@iconify-icons/bi/usb-plug-fill';
import chip from '@iconify-icons/mdi/chip';
import serverNetwork from '@iconify-icons/mdi/server-network';
import harddisk from '@iconify-icons/mdi/harddisk';


@Dialog
export class SwitchDiskDialog extends CommonDialog<HostInfo, boolean> {
    public override width: string = "600px";

    protected disks: DiskItem[] = [];
    protected currentDisk = "";
    protected iscsiTargets: IscsiTargetInfo[] = [];
    protected iscsiTargetsLoading = false;
    protected form = {
        disk: "",   // 选中的磁盘
        iscsi_ip: "",
        iscsi_port: 3260,
        iscsi_username: "",
        iscsi_password: "",
        iscsi_target: "",
        iscsi_lun: 0,
        nbd_ip: "",
        nbd_port: 10809,
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
            this.iscsiTargets = [{
                target: res.iscsi_info.target,
                luns: [{ device: "", image_size_gb: 0, lun: res.iscsi_info.lun }]
            }];
        }
        if (res.nbd_info) {
            this.form.nbd_ip = res.nbd_info.ip;
            this.form.nbd_port = res.nbd_info.port;
        }

        return super.show(data);
    }

    @ErrorProxy({ success: i18n.t("instance.switchSDKSuccess"), loading: i18n.t("loading") })
    protected override async onConfirm() {
        if (this.form.disk === this.currentDisk && this.form.disk !== "iscsi" && this.form.disk !== "nbd") {
            this.close(false);
            return;
        }

        let iscsiInfo: IscsiInfo | undefined;
        let nbdInfo: NbdInfo | undefined;
        if (this.form.disk === 'iscsi') {
            // 提交前校验 iSCSI 表单（含 Target 格式），不通过则中止
            const form = this.$refs.iscsiForm as { validate: () => Promise<boolean> } | undefined;
            const valid = await form?.validate().catch(() => false);
            if (!valid) return false;
            iscsiInfo = {
                ip: this.form.iscsi_ip,
                port: this.form.iscsi_port,
                username: this.form.iscsi_username,
                password: this.form.iscsi_password,
                target: this.form.iscsi_target,
                lun: this.form.iscsi_lun
            };
        }
        if (this.form.disk === 'nbd') {
            const form = this.$refs.nbdForm as { validate: () => Promise<boolean> } | undefined;
            const valid = await form?.validate().catch(() => false);
            if (!valid) return false;
            nbdInfo = {
                ip: this.form.nbd_ip,
                port: this.form.nbd_port
            };
        }

        await deviceApi.switchDisk(this.data.address, this.form.disk, iscsiInfo, nbdInfo);

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
                { required: true, message: i18n.t("notNull"), trigger: "change" }
            ],
            iscsi_lun: [
                { required: true, message: i18n.t("notNull"), trigger: "change" },
                { type: 'number', min: 0, message: "Lun >= 0", trigger: 'blur' }
            ],
            nbd_ip: [
                { required: true, message: i18n.t("notNull"), trigger: "blur" }
            ],
            nbd_port: [
                { required: true, message: i18n.t("notNull"), trigger: "blur" },
                { type: 'number', min: 1, message: "Port >= 1", trigger: 'blur' }
            ],
        };
    }

    private get selectedIscsiLuns(): IscsiLunInfo[] {
        return this.iscsiTargets.find(x => x.target === this.form.iscsi_target)?.luns ?? [];
    }

    private get canQueryIscsiTargets() {
        return !!this.form.iscsi_ip.trim() && Number(this.form.iscsi_port) > 0;
    }

    private resetIscsiTargetOptions() {
        this.iscsiTargets = [];
        this.form.iscsi_target = "";
        this.form.iscsi_lun = 0;
    }

    private selectFirstIscsiLun(target?: IscsiTargetInfo) {
        const firstLun = target?.luns?.[0];
        this.form.iscsi_lun = firstLun ? firstLun.lun : 0;
    }

    private onIscsiTargetChange(target: string) {
        this.form.iscsi_target = target;
        this.selectFirstIscsiLun(this.iscsiTargets.find(x => x.target === target));
    }

    private formatIscsiLun(lun: IscsiLunInfo) {
        const parts = [`LUN ${lun.lun}`];
        if (lun.device) parts.push(lun.device);
        if (lun.image_size_gb) parts.push(`${lun.image_size_gb}GB`);
        return parts.join(" / ");
    }

    private async queryIscsiTargets() {
        if (!this.canQueryIscsiTargets || this.iscsiTargetsLoading) return;

        this.iscsiTargetsLoading = true;
        try {
            const targets = await deviceApi.getIscsiTargets(this.data.address, {
                ip: this.form.iscsi_ip,
                port: this.form.iscsi_port,
                username: this.form.iscsi_username,
                password: this.form.iscsi_password,
            });

            this.iscsiTargets = targets ?? [];
            const selectedTarget = this.iscsiTargets.find(x => x.target === this.form.iscsi_target) ?? this.iscsiTargets[0];
            this.form.iscsi_target = selectedTarget?.target ?? "";
            this.selectFirstIscsiLun(selectedTarget);
        } catch (e: any) {
            this.$message.error(e?.message ?? "iSCSI targets query failed");
        } finally {
            this.iscsiTargetsLoading = false;
        }
    }

    @ErrorProxy({ confirm: i18n.t("vmDetail.formatDiskConfirm"), success: i18n.t("vmDetail.formatDiskSuccess"), loading: i18n.t("loading") })
    private async formatDisk() {
        await deviceApi.formatDisk(this.data.address);
    }

    private getDiskIcon(disk: string) {
        if (!disk) return "";
        const d = disk.toLowerCase();
        if (d.includes("nvme")) return hardDiskRounded;
        if (d.includes("usb")) return usbPlugFill;
        if (d.includes("emmc")) return chip;
        if (d.includes("iscsi")) return serverNetwork;
        if (d.includes("nbd")) return serverNetwork;
        return harddisk;
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
                        ref="iscsiForm"
                        label-position="left"
                        label-width="120px"
                        props={{ model: this.form }}
                        rules={this.formRules}
                    >
                        <el-form-item label={this.$t("vmDetail.iscsi.ip")} prop="iscsi_ip">
                            <el-input value={this.form.iscsi_ip} onInput={(v: string) => { this.form.iscsi_ip = v; this.resetIscsiTargetOptions(); }} />
                        </el-form-item>
                        <el-form-item label={this.$t("vmDetail.iscsi.port")} prop="iscsi_port">
                            <el-input value={this.form.iscsi_port} type="number" onInput={(v: string) => { this.form.iscsi_port = Number(v); this.resetIscsiTargetOptions(); }} />
                        </el-form-item>
                        <el-form-item label={this.$t("vmDetail.iscsi.username")} prop="iscsi_username">
                            <el-input value={this.form.iscsi_username} onInput={(v: string) => { this.form.iscsi_username = v; this.resetIscsiTargetOptions(); }} />
                        </el-form-item>
                        <el-form-item label={this.$t("vmDetail.iscsi.password")} prop="iscsi_password">
                            <el-input type="password" value={this.form.iscsi_password} show-password onInput={(v: string) => { this.form.iscsi_password = v; this.resetIscsiTargetOptions(); }} />
                        </el-form-item>
                        <el-form-item label=" ">
                            <el-button
                                type="primary"
                                size="small"
                                loading={this.iscsiTargetsLoading}
                                disabled={!this.canQueryIscsiTargets}
                                onClick={() => this.queryIscsiTargets()}
                            >
                                {this.$t("vmDetail.iscsi.queryTargets")}
                            </el-button>
                        </el-form-item>
                        <el-form-item label={this.$t("vmDetail.iscsi.target")} prop="iscsi_target">
                            <el-select
                                v-model={this.form.iscsi_target}
                                style={{ width: "100%" }}
                                disabled={this.iscsiTargets.length === 0}
                                placeholder={this.$t("vmDetail.iscsi.targetPlaceholder")}
                                onChange={this.onIscsiTargetChange}
                            >
                                {this.iscsiTargets.map(item => (
                                    <el-option key={item.target} label={item.target} value={item.target} />
                                ))}
                            </el-select>
                        </el-form-item>
                        <el-form-item label={this.$t("vmDetail.iscsi.lun")} prop="iscsi_lun">
                            <el-select
                                v-model={this.form.iscsi_lun}
                                style={{ width: "100%" }}
                                disabled={this.selectedIscsiLuns.length === 0}
                            >
                                {this.selectedIscsiLuns.map(lun => (
                                    <el-option key={lun.lun} label={this.formatIscsiLun(lun)} value={lun.lun} />
                                ))}
                            </el-select>
                        </el-form-item>
                    </el-form>
                ) : null}

                {this.form.disk === 'nbd' ? (
                    <el-form
                        ref="nbdForm"
                        label-position="left"
                        label-width="120px"
                        props={{ model: this.form }}
                        rules={this.formRules}
                    >
                        <el-form-item label={this.$t("vmDetail.nbd.ip")} prop="nbd_ip">
                            <el-input v-model={this.form.nbd_ip} />
                        </el-form-item>
                        <el-form-item label={this.$t("vmDetail.nbd.port")} prop="nbd_port">
                            <el-input v-model={this.form.nbd_port} type="number" min="1" onInput={(v: string) => this.form.nbd_port = Number(v)} />
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
