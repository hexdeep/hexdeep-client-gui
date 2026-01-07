import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { i18n } from "@/i18n/i18n";
import { sleep } from "@/common/common";
import { HostInfo, DiskItem } from "@/api/device_define";


@Dialog
export class SwitchDiskDialog extends CommonDialog<HostInfo, boolean> {
    public override width: string = "600px";

    protected disks: DiskItem[] = [];
    protected currentDisk = "";
    protected form = {
        disk: "",   // 选中的磁盘
    };

    public override async show(data: HostInfo) {
        this.title = this.$t("vmDetail.switchDisk").toString();
        this.data = data;

        // ⭐ 打开对话框时获取磁盘信息
        const res = await deviceApi.getDisks(data.address);
        this.disks = res.list;
        this.currentDisk = res.current_disk;
        this.form.disk = res.current_disk;

        return super.show(data);
    }

    @ErrorProxy({ success: i18n.t("instance.switchSDKSuccess"), loading: i18n.t("loading") })
    protected override async onConfirm() {
        if (this.form.disk === this.currentDisk) {
            this.close(false);
            return;
        }

        await deviceApi.switchDisk(this.data.address, this.form.disk);

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
            disk: [
                { required: true, message: i18n.t("notNull"), trigger: "change" },
            ],
        };
    }

    protected renderDialog(): VNode {
        return (
            <el-form
                label-position="top"
                props={{ model: this.form }}
                rules={this.formRules}
            >
                <el-form-item prop="disk">
                    <el-radio-group v-model={this.form.disk}>
                        {this.disks.map(disk => (
                            <el-radio
                                key={disk.name}
                                label={disk.name}
                                disabled={!disk.enabled}
                            >
                                {disk.name}
                                {disk.name === this.currentDisk ? (
                                    <span style={{ color: "#999", marginLeft: "0px" }}>
                                        （{this.$t("vmDetail.currentDisk")}）
                                    </span>
                                ) : null}
                            </el-radio>
                        ))}
                    </el-radio-group>
                </el-form-item>
            </el-form>
        );
    }

}
