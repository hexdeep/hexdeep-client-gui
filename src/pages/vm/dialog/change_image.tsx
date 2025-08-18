

import { deviceApi } from '@/api/device_api';
import { DeviceInfo, ImageInfo } from "@/api/device_define";
import { i18n } from "@/i18n/i18n";
import { ImageSelector2 } from "@/lib/component/image_selector2";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { PullImageDialog } from "./pull_image";

@Dialog
export class ChangeImageDialog extends CommonDialog<DeviceInfo[], boolean> {
    protected images: ImageInfo[] = [];
    protected obj = { image_addr: "", custom_image: "" };
    public override show(data: DeviceInfo[]) {
        this.title = this.$t("changeImage.title").toString();
        this.data = data;
        deviceApi.getImages(this.data.first.hostIp).then((images) => {
            this.images = images;
        });
        return super.show(data);
    }

    @ErrorProxy({ validatForm: "formRef" })
    protected override async onConfirm() {
        var gp = this.data.groupBy(x => x.hostIp);
        for (var ip of Object.keys(gp)) {
            var imgs = await deviceApi.getImages(ip);
            var image = imgs.find(x => x.address == this.obj.image_addr);
            if (image && !image.download) {
                const err = await this.$dialog(PullImageDialog).show({
                    hostIp: ip,
                    imageAddress: this.obj.image_addr!,
                });
                if (err) throw err;
            }
        }
        this.confirming();
    }

    @ErrorProxy({ success: i18n.t("changeImage.success"), loading: i18n.t("loading") })
    protected async confirming() {
        var tasks: Promise<void>[] = [];
        let error: any;
        const image_addr = this.obj.image_addr == "[customImage]" ? this.obj.custom_image : this.obj.image_addr;
        this.data.forEach(x => {
            tasks.push(deviceApi.update({ info: x, hostId: x.hostId, obj: { name: "", image_addr: image_addr } }).catch(e => {
                error = e;
            }));
        });
        await Promise.allSettled(tasks).catch(e => {
            console.log(e);
        });
        if (error) throw error;
        this.close(true);
    }

    private get formRules() {
        return {
            image_addr: [
                { required: true, message: i18n.t("notNull"), trigger: 'change' },
            ],
            custom_image: [
                { required: true, message: i18n.t("notNull"), trigger: 'change' }
            ],
        };
    }
    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" label-position="top" props={{ model: this.obj }} rules={this.formRules}>
                <el-form-item label={this.$t("changeImage.label")} prop="image_addr"  >
                    <ImageSelector2 images={this.images} v-model={this.obj.image_addr} />
                </el-form-item>
                {this.obj.image_addr == "[customImage]" && <el-form-item label={this.$t("customImage")} prop="custom_image">
                    <el-input v-model={this.obj.custom_image} />
                </el-form-item>}
            </el-form>
        );
    }
}