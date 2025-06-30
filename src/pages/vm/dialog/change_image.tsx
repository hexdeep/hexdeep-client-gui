

import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { DeviceInfo, ImageInfo } from "@/api/device_define";
import { i18n } from "@/i18n/i18n";
import { ImageSelector } from "@/lib/component/image_selector";

@Dialog
export class ChangeImageDialog extends CommonDialog<DeviceInfo[], boolean> {
    protected images: ImageInfo[] = [];
    protected obj = { image_addr: "" };
    public override show(data: DeviceInfo[]) {
        this.title = this.$t("changeImage.title").toString();
        this.data = data;
        deviceApi.getImages(this.data.first.hostIp).then((images) => {
            this.images = images;
        });
        return super.show(data);
    }

    @ErrorProxy({ loading: i18n.t("loading"), validatForm: "formRef" })
    protected override async onConfirm() {
        var gp = this.data.groupBy(x => x.hostIp);
        for (var ip of Object.keys(gp)) {
            var imgs = await deviceApi.getImages(ip);
            var image = imgs.find(x => x.address == this.obj.image_addr);
            if (image && !image.download) {
                await deviceApi.pullImages(ip, image.address);
            }
        }

        await this.confirming();
        this.close(true);
    }

    @ErrorProxy({ success: i18n.t("changeImage.success"), loading: i18n.t("loading") })
    protected async confirming() {
        var tasks: Promise<void>[] = [];
        this.data.forEach(x => {
            tasks.push(deviceApi.update({ info: x, obj: { name: "", image_addr: this.obj.image_addr } }));
        });
        await Promise.all(tasks);
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
                    <ImageSelector images={this.images} v-model={this.obj.image_addr} />
                </el-form-item>
            </el-form>
        );
    }
}