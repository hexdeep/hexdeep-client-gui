

import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { DeviceInfo } from "@/api/device_define";
import { ModelEditor } from "@/lib/component/model_editor";
import { i18n } from "@/i18n/i18n";

@Dialog
export class ChangeModelDialog extends CommonDialog<DeviceInfo, boolean> {
    protected model_id = 0;
    public override show(data: DeviceInfo) {
        console.log(data)
        this.data = data;
        this.title = this.$t("changeModel.title").toString();// "修改设备名称";
        return super.show(data);
    }

    @ErrorProxy({ success: i18n.t("changeModel.success"), loading: i18n.t("loading"), validatForm: "formRef" })
    protected override async onConfirm() {
        console.log(this.data, this.model_id)
        await deviceApi.changeModel(this.data.hostIp, this.data.name, this.model_id);
        this.close(true);
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this }} label-position="top">
                <el-form-item label={this.$t("create.model_id")} prop="model_id"  >
                    <ModelEditor v-model={this.model_id} />
                </el-form-item>
            </el-form>
        );
    }
}