import { deviceApi } from '@/api/device_api';
import { CreateParam, DockerEditParam, ImageInfo } from "@/api/device_define";
import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { Watch } from "vue-property-decorator";
import { CreateForm } from "../../../lib/component/create_form";
import { PullImageDialog } from './pull_image';

@Dialog
export class CreateDialog extends CommonDialog<DockerEditParam, CreateParam> {
    public override width: string = "650px";
    protected images: ImageInfo[] = [];
    private dirty = 0;
    public override allowEscape: boolean = false;

    public override show(data: DockerEditParam) {
        this.data = data;
        this.title = data.isUpdate ? this.$t("menu.updateVm").toString() : this.$t("createVm").toString();
        deviceApi.getImages(this.data.info.hostIp).then((images) => {
            this.images = images;
        });
        return super.show(data);
    }

    @Watch("data", { deep: true })
    protected onDataChange() {
        this.dirty++;
    }

    @ErrorProxy({ validatForm: "formRef" })
    protected override async onConfirm() {
        if (this.dirty < 2) {
            this.close();
            return;
        };
        if (this.data.obj.image_addr) {
            var image = this.images.find(x => x.address == this.data.obj.image_addr);
            if (image && !image.download) {
                const err = await this.$dialog(PullImageDialog).show({
                    hostIp: this.data.info.hostIp,
                    imageAddress: this.data.obj.image_addr!,
                });
                if (err) throw err;
            }
        }
        this.confirming();
    }

    @ErrorProxy({ success: i18n.t("success"), loading: i18n.t("loading") })
    protected async confirming() {
        const data = Object.assign({}, this.data);
        data.obj = Object.assign({}, this.data.obj);
        if (data.obj.image_addr === "[customImage]") {
            data.obj.image_addr = data.obj.custom_image;
            delete data.obj.custom_image;
        } else {
            delete data.obj.custom_image;
        }
        if (this.data.isUpdate) {
            await deviceApi.update(data);
        } else {
            await deviceApi.create(data);
            let re: any = "";

            re = await this.$confirm(this.$t("create.start").toString(), this.$t("confirm.title").toString(), {
                confirmButtonText: this.$t("confirm.ok").toString(),
                cancelButtonText: this.$t("confirm.cancel").toString(),
                type: "warning",
            }).catch(e => "cancel");
            if (re == "confirm") await deviceApi.start(this.data.info.hostIp, `${this.data.hostId}_${this.data.info.index}_${this.data.obj.name}`);
        }
        this.close(this.data.obj);
    }

    protected get formRules() {
        return {
            name: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
                { min: 1, max: 20, message: i18n.t("create.nameRule"), trigger: 'blur' },
                { pattern: /^[a-zA-Z0-9_]*$/, message: i18n.t("noMinus"), trigger: 'blur' },

            ],
            image_addr: [
                { required: true, message: i18n.t("notNull"), trigger: 'change' }
            ],
            ip: [
                { required: this.data.obj.mac_vlan == 1, message: i18n.t("notNull"), trigger: 'blur' },
                { pattern: /^((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})(\.((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})){3}$/, message: i18n.t("invalidIp"), trigger: 'blur' },
            ]
        };
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this.data.obj }} rules={this.formRules} label-width="140px" >
                <CreateForm data={this.data.obj} images={this.images} isUpdate={this.data.isUpdate}></CreateForm>
            </el-form>
        );
    }
}