import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { i18n } from "@/i18n/i18n";
import { HostInfo } from "@/api/device_define";

@Dialog
export class RemarkDialog extends CommonDialog<HostInfo, string> {
    private newName: string = "";
    public override show(data: HostInfo) {
        this.title = this.$t("remark.title").toString();// "修改主机备注";
        this.newName = data.remark;
        return super.show(data);
    }

    @ErrorProxy({ success: i18n.t("remark.success"), validatForm: "formRef", loading: i18n.t("loading") })
    protected override async onConfirm() {
        await deviceApi.setHostRemark(this.data.address, this.newName);
        this.close(this.newName);
    }

    private get formRules() {
        return {
            newName: [
                { max: 6, message: i18n.t("rename.length"), trigger: 'blur' },
                { pattern: /^[a-zA-Z0-9_]*$/, message: i18n.t("noMinus"), trigger: 'blur' },
            ],
        };
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this }} rules={this.formRules}>
                <el-form-item label={this.$t("remark.hostRemark")} prop="newName">
                    <el-input v-model={this.newName} maxlength={6} />
                </el-form-item>
            </el-form>
        );
    }
}