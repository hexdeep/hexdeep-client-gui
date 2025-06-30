import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { i18n } from "@/i18n/i18n";
import { DeviceInfo } from "@/api/device_define";

@Dialog
export class RenameDialog extends CommonDialog<DeviceInfo, string> {
    private newName: string = "";
    public override show(data: DeviceInfo) {
        this.title = this.$t("rename.title").toString();// "修改设备名称";
        this.newName = data.name.last();
        return super.show(data);
    }

    @ErrorProxy({ success: i18n.t("rename.success"), validatForm: "formRef", loading: i18n.t("loading") })
    protected override async onConfirm() {
        await deviceApi.rename(this.data.hostIp, this.data.name, this.newName);
        var arr = this.data.name.split("_");
        arr.splice(arr.length - 1, 1, this.newName);
        this.close(arr.join("_"));
    }

    private get formRules() {
        return {
            newName: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
                { min: 1, max: 50, message: i18n.t("rename.length"), trigger: 'blur' },
                { pattern: /^[a-zA-Z0-9]*$/, message: i18n.t("noMinus"), trigger: 'blur' },
            ],
        };
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this }} rules={this.formRules}>
                <el-form-item label={this.$t("rename.deviceName")} prop="newName">
                    <el-input v-model={this.newName} maxlength={50} />
                </el-form-item>
            </el-form>
        );
    }
}