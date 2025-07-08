

import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi, } from '@/api/device_api';
import { DeviceInfo, S5setParam } from "@/api/device_define";

@Dialog
export class S5setDialog extends CommonDialog<DeviceInfo[], boolean> {
    private isOpen = true
    private item: S5setParam = {};
    public override show(data: DeviceInfo[]) {
        this.data = data;
        this.title = this.$t("s5set.title").toString();

        return super.show(data);
    }

    @ErrorProxy({ success: i18n.t("s5set.success"), loading: i18n.t("loading"), validatForm: "formRef" })
    protected override async onConfirm() {
        let tasks: Promise<void>[] = [];
        this.data.forEach(async e => {
            if (e.state) tasks.push(deviceApi.s5set(e.hostIp, e.name, this.item));
        });
        await Promise.all(tasks)
        this.close(true);
    }

    private get formRules() {
        return {
            // name: [
            //     { required: true, message: '必填项', trigger: 'blur' },
            //     { min: 1, max: 50, message: i18n.t("create.nameRule"), trigger: 'blur' },
            //     { pattern: /^[a-zA-Z0-9]*$/, message: i18n.t("noMinus"), trigger: 'blur' },
            // ],
        };
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this.item }} rules={this.formRules} label-position="top">
                <el-form-item label={this.$t("create.open_s5")}  >
                    <el-switch v-model={this.item.s5_domain_mode} active-value={1} active-text={this.$t("create.s5_domain_mode1")} inactive-value={2} inactive-text={this.$t("create.s5_domain_mode2")} />
                </el-form-item>
                <el-form-item label={this.$t("create.s5_domain_mode")} prop="s5_domain_mode">
                    <el-switch v-model={this.item.s5_domain_mode} active-value={1} active-text={this.$t("create.s5_domain_mode1")} inactive-value={2} inactive-text={this.$t("create.s5_domain_mode2")} />
                </el-form-item>
                <el-form-item label={this.$t("create.s5_ip")} prop="s5_ip">
                    <el-input v-model={this.item.s5_ip} />
                </el-form-item>
                <el-form-item label={this.$t("create.s5_port")} prop="s5_port">
                    <el-input v-model={this.item.s5_port} type="number" min={1} max={65535} />
                </el-form-item>
                <el-form-item label={this.$t("create.s5_user")} prop="s5_user">
                    <el-input v-model={this.item.s5_user} />
                </el-form-item>
                <el-form-item label={this.$t("create.s5_pwd")} prop="s5_pwd">
                    <el-input v-model={this.item.s5_pwd} />
                </el-form-item>
                {/* <el-form-item label={this.$t("create.dns_urls")} prop="dns_urls">
                    <el-input v-model={this.item.dns_urls} />
                </el-form-item> */}
            </el-form >
        );
    }
}