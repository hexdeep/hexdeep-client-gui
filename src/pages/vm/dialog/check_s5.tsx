import { deviceApi } from '@/api/device_api';
import { S5setParam } from "@/api/device_define";
import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";

interface CheckS5FormData {
    hostIp: string;
    s5Param: S5setParam;
}

@Dialog
export class CheckS5Dialog extends CommonDialog<CheckS5FormData> {
    private formData = {
        check_url: "https://www.google.com"
    };
    public override show(data: CheckS5FormData) {
        this.title = this.$t("checkS5.title").toString();
        return super.show(data);
    }

    @ErrorProxy({
        loading: i18n.t("loading"),
        error: i18n.t("checkS5.fail"),
        success: i18n.t("checkS5.success"),
        validatForm: "formRef"
    })
    protected override async onConfirm() {
        const result = await deviceApi.checkS5(this.data.hostIp, this.data.s5Param, this.formData.check_url);
        if (result === "success") {
            this.close();
        } else {
            throw new Error(i18n.t("checkS5.fail").toString());
        }
    }

    private get formRules() {
        return {
            check_url: [
                { required: true, message: i18n.t("notNull"), trigger: 'change' },
                // {
                //     validator: (rule: any, value: string, callback: any) => {
                //         if (!/^https?:\/\/.*/.test(value)) {
                //             callback(new Error(i18n.t("checkS5.urlError").toString()));
                //         } else {
                //             callback();
                //         }
                //     },
                //     trigger: 'change'
                // }
            ],
        };
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" label-position="top" props={{ model: this.formData }} rules={this.formRules}>
                <el-input v-model={this.formData.check_url} placeholder={this.$t("checkS5.label")} />
            </el-form>
        );
    }
}