import { deviceApi } from '@/api/device_api';
import { orderApi } from "@/api/order_api";
import { CreateParam, DockerEditParam, ImageInfo } from "@/api/device_define";
import { i18n } from "@/i18n/i18n";
import { getSuffixName } from '@/common/common';
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
    private dockerRegistries: string[] = [];
    private validInstance: number[] = [];
    private validIndex: number = 0;
    private dirty = 0;
    public override allowEscape: boolean = false;

    public override async show(data: DockerEditParam) {
        this.data = data;
        const vmName = getSuffixName(data.info.name);
        const vmNo = data.info.index;
        const ip = data.info.hostIp;
        const vmInfo = `${ip}(${vmNo}-${vmName})`;
        this.title = data.isUpdate ? `${this.$t("menu.updateVm")} ${vmInfo}` : `${this.$t("createVm")} ${ip}`;
        deviceApi.getImages(this.data.info.hostIp).then((images) => {
            this.images = images;
        });
        deviceApi.getDockerRegistries(this.data.info.hostIp).then((list) => {
            this.dockerRegistries = Array.isArray(list) ? list : [];
        });
        await this.hostIpChange();
        return super.show(data);
    }

    @Watch("data", { deep: true })
    protected onDataChange() {
        this.dirty++;
    }

    protected async hostIpChange() {
        let record = await orderApi.getRental(this.data.hostId) || [];
        let arr = Array.from({ length: 12 }, (_, index) => index + 1);

        if (record.length > 0) {
            arr.removeWhere(x =>
                record.first.device_indexes.contains(y => y.index === x && y.state === "expired")
                || !record.first.device_indexes.contains(y => y.index === x)
            );
        } else {
            arr = [];
        }
        //arr.forEach((x, i) => console.log(`arr[${i}] = ${x}`));
        this.validInstance = arr || [];
        this.validIndex = arr.length > 0 ? (arr.includes(this.data.info.index ?? 0) ? this.data.info.index ?? 0 : arr.first) : 0;
    }

    @ErrorProxy({ validatForm: "formRef" })
    protected override async onConfirm() {
        if (this.dirty < 2) {
            this.close();
            return;
        };
        const image_addr = this.data.obj.image_addr == "[customImage]" ? this.data.obj.custom_image : this.data.obj.image_addr;
        if (image_addr && ((image_addr.includes('.') && image_addr.includes('/')))) {
            var image = this.images.find(x => x.address == image_addr);
            if (!image || !image.download) {
                const err = await this.$dialog(PullImageDialog).show({
                    hostIp: this.data.info.hostIp,
                    imageAddress: image_addr!,
                    dockerRegistry: this.data.obj.docker_registry,
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
            if (!data.obj.index) {
                console.log("data.obj.index is " + data.obj.index + " valieindex is " + this.validIndex);
                data.obj.index = this.validIndex;
            }
            await deviceApi.create(data);
            let re: any = "";

            re = await this.$confirm(this.$t("create.start").toString(), this.$t("confirm.title").toString(), {
                confirmButtonText: this.$t("confirm.ok").toString(),
                cancelButtonText: this.$t("confirm.cancel").toString(),
                type: "warning",
            }).catch(e => "cancel");
            if (re == "confirm") await deviceApi.start(this.data.info.hostIp, `${this.data.hostId}_${data.obj.index}_${this.data.obj.name}`);
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
            ],
            host: [
                { required: this.data.obj.isOpenProxy && this.data.obj.protocol_type == 1, message: i18n.t("notNull"), trigger: 'blur' },
                // { pattern: /^((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})(\.((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})){3}$/, message: i18n.t("invalidIp"), trigger: 'blur' },
            ],
            protocol_type: [
                { required: this.data.obj.isOpenProxy, message: i18n.t("notNull"), trigger: 'blur' },
            ],
            address: [{
                required: this.data.obj.isOpenProxy && this.data.obj.protocol_type != 1, message: i18n.t("notNull"), trigger: 'blur'
            },],
            port: [
                { required: this.data.obj.isOpenProxy && this.data.obj.protocol_type == 1, message: i18n.t("notNull"), trigger: 'blur' },
                { pattern: /^([0-9]|[1-9]\d{1,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/, message: i18n.t("invalidPort"), trigger: 'blur' },
            ]
        };
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this.data.obj }} rules={this.formRules} label-width="150px">
                {this.data.isUpdate && <div style="color: red; margin-bottom: 10px; margin-left: 140px;">{this.$t("changeImage.warning")}</div>}
                <CreateForm data={this.data.obj} images={this.images} dockerRegistries={this.dockerRegistries} validInstance={this.validInstance} validIndex={this.validIndex} isUpdate={this.data.isUpdate} ></CreateForm>
            </el-form>
        );
    }
}
