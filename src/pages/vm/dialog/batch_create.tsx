

import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { DockerBatchCreateParam, ImageInfo } from "@/api/device_define";
import { CreateForm } from "../../../lib/component/create_form";
import { Row } from "@/lib/container";
import s from './batch_create.module.less';


@Dialog
export class BatchCreateDialog extends CommonDialog<DockerBatchCreateParam, boolean> {
    public override width: string = "650px";
    protected images: ImageInfo[] = [];
    public override show(data: DockerBatchCreateParam) {
        this.data = data;
        this.title = i18n.t("createVm").toString();
        deviceApi.getImages(this.data.hostIp.first).then((images) => {
            this.images = images;
        });
        return super.show(data);
    }

    @ErrorProxy({ loading: i18n.t("create.downloadingImage") })
    protected override async onConfirm() {
        if (this.data.obj.image_addr) {
            for (var ip of this.data.hostIp) {
                var imgs = await deviceApi.getImages(ip);
                var image = imgs.find(x => x.address == this.data.obj.image_addr);
                if (image && !image.download) {
                    await deviceApi.pullImages(ip, this.data.obj.image_addr.toLocaleLowerCase());
                }
            }
        }

        localStorage.setItem("suffix_name", this.data.obj.suffix_name || "");
        this.confirming();
    }

    @ErrorProxy({ success: i18n.t("batchCreate.success"), loading: i18n.t("loading"), validatForm: "formRef" })
    protected async confirming() {
        var tasks: Promise<void>[] = [];
        this.data.hostIp.forEach(ip => {
            tasks.push(deviceApi.batchCreate(ip, this.data.obj.num!, this.data.obj.suffix_name!, this.data.obj));
        });
        await Promise.all(tasks);
        this.close(true);
    }

    protected get formRules() {
        return {
            name: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
                { min: 1, max: 20, message: i18n.t("create.nameRule"), trigger: 'blur' },
                { pattern: /^[a-zA-Z0-9_]*$/, message: i18n.t("noMinus"), trigger: 'blur' },
            ],
            num: [
                {
                    required: true, message: i18n.t("create.numRule", { 0: this.data.maxNum }), min: 1,
                    max: this.data.maxNum, trigger: 'blur', type: "integer", transform(value) {
                        return Number(value);
                    }
                },
            ],
            suffix_name: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
                { min: 1, max: 20, message: i18n.t("create.nameRule"), trigger: 'blur' },
                { pattern: /^[a-zA-Z0-9_]*$/, message: i18n.t("noMinus"), trigger: 'blur' },

            ],
            ip: [
                { required: this.data.obj.mac_vlan == 1, message: i18n.t("notNull"), trigger: 'blur' },
                { pattern: /^((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})(\.((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})){3}$/, message: i18n.t("invalidIp"), trigger: 'blur' },
            ]
        };
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this.data.obj }} rules={this.formRules} label-width="140px" class={s.form}>
                <div class={s.tip}>{this.$t("create.tip", { 0: this.data.maxNum })}</div>
                <CreateForm data={this.data.obj} needName={false} images={this.images}>
                    <Row>
                        <el-form-item label={this.$t("batchCreate.num")} prop="num" style={{ "width": "100%" }}>
                            <el-input v-model={this.data.obj.num} min={1} max={this.data.maxNum} type="number" />
                        </el-form-item>
                        <el-form-item label={this.$t("batchCreate.suffixName")} prop="suffix_name" style={{ "width": "100%" }}>
                            <el-input v-model={this.data.obj.suffix_name} maxlength={20} />
                        </el-form-item>
                    </Row>
                </CreateForm>
            </el-form>
        );
    }
}