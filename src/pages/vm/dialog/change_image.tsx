

import { deviceApi } from '@/api/device_api';
import { DeviceInfo, ImageInfo } from "@/api/device_define";
import { i18n } from "@/i18n/i18n";
import { ImageSelector2 } from "@/lib/component/image_selector2";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { PullImageDialog } from "./pull_image";
import { Watch } from 'vue-property-decorator';

@Dialog
export class ChangeImageDialog extends CommonDialog<DeviceInfo[], boolean> {
    protected images: ImageInfo[] = [];
    protected dockerRegistries: string[] = [];
    protected obj = { image_addr: "", custom_image: "", docker_registry: "" };
    public override show(data: DeviceInfo[]) {
        this.title = this.$t("changeImage.title").toString();
        this.data = data;
        deviceApi.getImages(this.data.first.hostIp).then((images) => {
            this.images = images;
        });
        deviceApi.getDockerRegistries(this.data.first.hostIp).then((list) => {
            this.dockerRegistries = Array.isArray(list) ? list : [];
        });
        return super.show(data);
    }

    @ErrorProxy({ validatForm: "formRef" })
    protected override async onConfirm() {
        if (this.obj.image_addr && ((this.obj.image_addr.includes('.') && this.obj.image_addr.includes('/')))) {
            var gp = this.data.groupBy(x => x.hostIp);
            for (var ip of Object.keys(gp)) {
                var imgs = await deviceApi.getImages(ip);
                var image = imgs.find(x => x.address == this.obj.image_addr);
                if (image && !image.download && (image.address.includes('.') && image.address.includes('/'))) {
                    const err = await this.$dialog(PullImageDialog).show({
                        hostIp: ip,
                        imageAddress: this.obj.image_addr!,
                        dockerRegistry: this.obj.docker_registry,
                    });
                    if (err) throw err;
                }
            }
        }

        this.confirming();
    }

    @Watch("dockerRegistries", { immediate: true })
    onDockerRegistriesChange(list: string[]) {
        if (
            list &&
            list.length > 0 &&
            !this.obj.docker_registry
        ) {
            this.$set(this.obj, "docker_registry", list[0]);
        }
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

                {this.obj.image_addr != "[customImage]" && (
                    <el-form-item
                        label={this.$t("create.docker_registry")}
                        prop="docker_registry"
                    >
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <el-select
                                v-model={this.obj.docker_registry}
                                placeholder={this.$t("create.select_docker_registry")}
                                filterable
                                allow-create
                                clearable
                                style="flex: 1;"
                            >
                                {this.dockerRegistries.map(registry => (
                                    <el-option
                                        key={registry}
                                        label={registry}
                                        value={registry}
                                    />
                                ))}
                            </el-select>

                            <el-link
                                type="primary"
                                underline={false}
                                href={`https://download.hexdeep.com/super_sdk/docker_registry.exe?t=${Date.now()}`}
                                target="_blank"
                            >
                                {this.$t("create.download_docker_registry")}
                            </el-link>
                        </div>
                    </el-form-item>
                )}

            </el-form>
        );
    }
}