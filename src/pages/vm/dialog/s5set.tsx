

import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi, } from '@/api/device_api';
import { DeviceInfo, S5setParam } from "@/api/device_define";

@Dialog
export class S5setDialog extends CommonDialog<DeviceInfo[], boolean> {
    private isOpen = true;
    private item: S5setParam = {};
    public override show(data: DeviceInfo[]) {
        this.data = data;
        this.title = this.$t("s5set.title").toString();
        deviceApi.queryS5(data.first.hostIp, data.first.name).then(obj => {
            this.item = obj;
        });

        return super.show(data);
    }

    @ErrorProxy({ success: i18n.t("s5set.success"), loading: i18n.t("loading"), validatForm: "formRef" })
    protected override async onConfirm() {
        let tasks: Promise<void>[] = [];
        this.data.forEach(async e => {
            if (e.state) {
                if (this.isOpen) {
                    tasks.push(deviceApi.s5set(e.hostIp, e.name, this.item));
                } else {
                    tasks.push(deviceApi.closeS5(e.hostIp, e.name));
                }
            }
        });
        await Promise.allSettled(tasks).catch(e => {
            console.log(e);
        });
        this.close(true);
    }

    private get formRules() {
        return {
            s5_ip: [
                { required: this.isOpen, message: i18n.t("notNull"), trigger: 'blur' },
                { pattern: /^((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})(\.((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})){3}$/, message: i18n.t("invalidIp"), trigger: 'blur' },
            ],
            s5_port: [
                { required: this.isOpen, message: i18n.t("notNull"), trigger: 'blur' },
                { pattern: /^([0-9]|[1-9]\d{1,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/, message: i18n.t("invalidPort"), trigger: 'blur' },
            ]
        };
    }

    protected renderDialog(): VNode {
        return (
            <div style={{ "padding": "24px" }}>

                <el-form ref="formRef" props={{ model: this.item }} rules={this.formRules} label-position="left" label-width="200px">
                    <el-form-item label={this.$t("create.enableS5Proxy")}  >
                        <el-switch v-model={this.isOpen} active-value={true} active-text={this.$t("create.enable")} inactive-value={false} inactive-text={this.$t("create.disable")} />
                    </el-form-item>
                    <el-form-item label={this.$t("create.s5_domain_mode")} prop="s5_domain_mode">
                        <el-switch disabled={!this.isOpen} v-model={this.item.s5_domain_mode} active-value={2} active-text={this.$t("create.s5_domain_mode2")} inactive-value={1} inactive-text={this.$t("create.s5_domain_mode1")} />
                    </el-form-item>
                    <el-form-item label={this.$t("create.s5_ip")} prop="s5_ip">
                        <el-input disabled={!this.isOpen} v-model={this.item.s5_ip} />
                    </el-form-item>
                    <el-form-item label={this.$t("create.s5_port")} prop="s5_port">
                        <el-input disabled={!this.isOpen} v-model={this.item.s5_port} type="number" min={1} max={65535} />
                    </el-form-item>
                    <el-form-item label={this.$t("create.s5_user")} prop="s5_user">
                        <el-input disabled={!this.isOpen} v-model={this.item.s5_user} />
                    </el-form-item>
                    <el-form-item label={this.$t("create.s5_pwd")} prop="s5_pwd">
                        <el-input disabled={!this.isOpen} v-model={this.item.s5_pwd} />
                    </el-form-item>

                </el-form >
            </div>

        );
    }
}