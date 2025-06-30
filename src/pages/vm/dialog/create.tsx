

import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog, DrawerDialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { DockerEditParam, ImageInfo } from "@/api/device_define";
import { CreateForm } from "../../../lib/component/create_form";

@Dialog
export class CreateDialog extends CommonDialog<DockerEditParam, boolean> {
    public override width: string = "650px";
    protected images: ImageInfo[] = [];
    public override show(data: DockerEditParam) {
        this.data = data;
        this.title = data.isUpdate ? this.$t("menu.updateVm").toString() : this.$t("createVm").toString();
        deviceApi.getImages(this.data.info.hostIp).then((images) => {
            this.images = images;
        });
        return super.show(data);
    }

    @ErrorProxy({ loading: i18n.t("create.downloadingImage") })
    protected override async onConfirm() {
        if (this.data.obj.image_addr) {
            var image = this.images.find(x => x.address == this.data.obj.image_addr);
            if (!image || (image && !image.download)) {
                await deviceApi.pullImages(this.data.info.hostIp, this.data.obj.image_addr.toLocaleLowerCase());
            }
        }

        this.confirming();
    }

    @ErrorProxy({ success: i18n.t("success"), loading: i18n.t("loading"), validatForm: "formRef" })
    protected async confirming() {
        if (this.data.isUpdate) {
            await deviceApi.update(this.data);
        } else {
            await deviceApi.create(this.data);
            try {
                await this.$confirm(this.$t("create.start").toString(), this.$t("confirm.title").toString(), {
                    confirmButtonText: this.$t("confirm.ok").toString(),
                    cancelButtonText: this.$t("confirm.cancel").toString(),
                    type: "warning",
                });
                await deviceApi.start(this.data.info.hostIp, `hexdeep-${this.data.info.index}-${this.data.obj.name}`);
            } catch (ex) {
                console.log("canel" + ex);
            }
        }
        this.close(true);
    }

    protected get formRules() {
        return {
            name: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
                { min: 1, max: 50, message: i18n.t("create.nameRule"), trigger: 'blur' },
                { pattern: /^[a-zA-Z0-9]*$/, message: i18n.t("noMinus"), trigger: 'blur' },
            ],
        };
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this.data.obj }} rules={this.formRules} label-width="140px" >
                <CreateForm data={this.data.obj} images={this.images}></CreateForm>

            </el-form>
        );
    }
}