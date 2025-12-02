

import { deviceApi } from '@/api/device_api';
import { DockerBatchCreateParam, ImageInfo, MyConfig } from "@/api/device_define";
import { i18n } from "@/i18n/i18n";
import { Row } from "@/lib/container";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { MyButton } from "@/lib/my_button";
import { VNode } from "vue";
import { CreateForm } from "../../../lib/component/create_form";
import s from './batch_create.module.less';
import { CheckS5Dialog } from "./check_s5";
import { InjectReactive } from 'vue-property-decorator';
import { PullImageDialog } from './pull_image';


@Dialog
export class BatchCreateDialog extends CommonDialog<DockerBatchCreateParam, boolean> {
    @InjectReactive() private config!: MyConfig;
    public override width: string = "650px";
    protected images: ImageInfo[] = [];
    public override allowEscape: boolean = false;

    public override show(data: DockerBatchCreateParam) {
        this.data = data;
        this.title = i18n.t("batchCreateVm").toString();
        deviceApi.getImages(this.data.hostIp.first).then((images) => {
            this.images = images;
        });
        return super.show(data);
    }

    @ErrorProxy({ validatForm: "formRef" })
    protected override async onConfirm() {
        const image_addr = this.data.obj.image_addr == "[customImage]" ? this.data.obj.custom_image : this.data.obj.image_addr;
        if (image_addr && ((image_addr.includes('.') && image_addr.includes('/')))) {
            for (var ip of this.data.hostIp) {
                var imgs = await this.getImages(ip);
                var image = imgs.find(x => x.address == image_addr);
                if (!image || !image.download) {
                    const err = await this.$dialog(PullImageDialog).show({
                        hostIp: ip,
                        imageAddress: image_addr!,
                    });
                    if (err) throw err;
                }
            }
        }

        this.config.suffixName = this.data.obj.suffix_name || "";
        this.confirming();
    }

    private async getImages(ip: string) {
        const loading = this.$loading({
            lock: true,
            text: i18n.t("loading").toString(),
        });
        try {
            return await deviceApi.getImages(ip);
        } catch (error) {
            throw error;
        } finally {
            loading.close();
        }
    }

    @ErrorProxy({ success: i18n.t("batchCreate.success"), loading: i18n.t("loading") })
    protected async confirming() {
        var tasks: Promise<void>[] = [];
        this.data.hostIp.forEach(ip => {
            const obj = Object.assign({}, this.data.obj);
            if (obj.image_addr === "[customImage]") {
                obj.image_addr = obj.custom_image;
                delete obj.custom_image;
            } else {
                delete obj.custom_image;
            }
            tasks.push(deviceApi.batchCreate(ip, this.data.obj.num!, this.data.obj.suffix_name!, obj));
        });
        if (tasks.length == 1) {
            await tasks[0];
        } else {
            await Promise.allSettled(tasks).catch(e => {
                console.log(e);
            });
        }
        this.close(true);
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
            custom_image: [
                { required: true, message: i18n.t("notNull"), trigger: 'change' }
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
                <CreateForm data={this.data.obj} needName={false} images={this.images} validIndex={0} validInstance={[]}>
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

    // @ErrorProxy()
    // private checkS5() {
    //     if (!this.data.obj.host) throw new Error(i18n.t("checkS5.ipNotNull").toString());
    //     if (!this.data.obj.port) throw new Error(i18n.t("checkS5.portNotNull").toString());
    //     let checkS5FormData = {
    //         hostIp: this.data.hostIp[0],
    //         s5Param: this.data.obj,
    //     };
    //     this.$dialog(CheckS5Dialog).show(checkS5FormData);
    // }

    // protected override renderFooter() {
    //     return (
    //         <Row gap={10} padding={20}>
    //             <MyButton text={i18n.t("confirm.ok")} onClick={() => this.onConfirm()} type="primary" />
    //             <MyButton text={i18n.t("confirm.cancel")} onClick={() => this.close()} />
    //         </Row>
    //         // <Row class={"dialog-footer"} padding={20} mainAlign="flex-end">
    //         // {/* <MyButton text={i18n.t("checkS5.check")} onClick={() => this.checkS5()} plain /> */}

    //         // </Row>
    //     );
    // }
}