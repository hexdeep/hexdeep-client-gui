

import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { i18n } from "@/i18n/i18n";
import { SDKImageSelector } from "@/lib/component/sdk_image_selector";
import { sleep } from "@/common/common";

@Dialog
export class SwitchSDKDialog extends CommonDialog<string, boolean> {
    public override width: string = "600px";
    protected obj = { image_addr: "" };
    public override show(data: string) {
        this.title = this.$t("instance.switchSDKTitle").toString();
        this.data = data;

        return super.show(data);
    }

    @ErrorProxy({ success: i18n.t("instance.switchSDKSuccess"), loading: i18n.t("loading") })
    protected override async onConfirm() {
        await deviceApi.switchSDKImages(this.data, this.obj.image_addr.toLocaleLowerCase());
        //检测是否切换成功
        for (var i = 0; i < 5; i++) {
            await sleep(1000);
            try {
                await deviceApi.getDeviceList(this.data);
                break;
            } catch (e) {
                console.log(e);
            }
        }
        this.close(true);
    }

    private get formRules() {
        return {
            image_addr: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
            ],
        };
    }
    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" label-position="top" props={{ model: this.obj }} rules={this.formRules}>
                <el-form-item label={this.$t("changeImage.label")} prop="image_addr"  >
                    <SDKImageSelector hostIp={this.data} v-model={this.obj.image_addr} />
                </el-form-item>
            </el-form>
        );
    }
}