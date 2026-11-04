

import { deviceApi } from '@/api/device_api';
import { DeviceInfo, HostInfo, ImageInfo } from "@/api/device_define";
import { i18n } from "@/i18n/i18n";
import { ImageSelector2 } from "@/lib/component/image_selector2";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { PullImageDialog } from "./pull_image";
import { Watch } from 'vue-property-decorator';
import { VipHostSelectDialog } from "./vip_host_select";
import { orderApi } from "@/api/order_api";
import { isImageVersionCompatibleByModelVersion, timeDiff } from "@/common/common";

@Dialog
export class ChangeImageDialog extends CommonDialog<DeviceInfo[], boolean> {
    protected images: ImageInfo[] = [];
    protected dockerRegistries: string[] = [];
    protected obj = { image_addr: "", custom_image: "", docker_registry: "" };
    protected hasVip = false; // 当前主机是否已开通VIP
    protected allHosts: HostInfo[] = []; // 所有主机列表

    private static readonly REPOSITORY_PATTERN = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*|\d{1,3}(?:\.\d{1,3}){3})(?::\d{1,5})?(?:\/[a-zA-Z0-9]+(?:[._-][a-zA-Z0-9]+)*)*:[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$/;
    
    public override show(data: DeviceInfo[]) {
        this.title = this.$t("changeImage.title").toString();
        this.data = data;
        deviceApi.getImages(this.data.first.hostIp).then((images) => {
            this.images = images;
        });
        deviceApi.getDockerRegistries(this.data.first.hostIp).then((list) => {
            this.dockerRegistries = Array.isArray(list) ? list : [];
        });
        // 检查当前主机VIP状态
        this.checkVipStatus();
        // 获取所有主机列表（用于打开VIP选择弹框）
        deviceApi.getHosts().then(hosts => {
            this.allHosts = hosts;
        });
        return super.show(data);
    }

    // 只保留和所有被选中云机的 mobile_model_version 都兼容的镜像，避免选出提交时才会被拦下的组合
    private get filteredImages() {
        return this.images.filter(img =>
            this.data.every(item => isImageVersionCompatibleByModelVersion(item.create_req?.mobile_model_version, img.major_version))
        );
    }

    private async checkVipStatus() {
        try {
            const hostId = this.data.first.hostId;
            if (hostId) {
                const vipInfos = await orderApi.getDeviceVip(hostId);
                const vipInfo = vipInfos.find(v => v.id === hostId);
                if (vipInfo && vipInfo.rental_end_time) {
                    this.hasVip = timeDiff(vipInfo.rental_end_time, vipInfo.current_time, "second") > 0;
                } else {
                    this.hasVip = false;
                }
            }
        } catch (e) {
            console.warn("Failed to check VIP status:", e);
            this.hasVip = false;
        }
    }

    private async onVipRequired() {
        // 打开VIP选择弹框
        if (this.allHosts.length === 0) {
            this.allHosts = await deviceApi.getHosts();
        }
        // 找到当前主机
        const currentHost = this.allHosts.find(h => h.device_id === this.data.first.hostId);
        const result = await this.$dialog(VipHostSelectDialog).show({
            hosts: this.allHosts,
            currentHost: currentHost
        });
        if (result) {
            // 用户完成了购买，重新检查VIP状态
            await this.checkVipStatus();
        }
    }

    /** 与创建页面一致：HTTP(S) 自定义镜像必须指定合法的 repository:tag。 */
    private async requestRepository(): Promise<string | undefined> {
        try {
            const result = await this.$prompt(
                this.$t("pullImage.repositoryMessage").toString(),
                this.$t("pullImage.repositoryTitle").toString(),
                {
                    confirmButtonText: this.$t("confirm.ok").toString(),
                    cancelButtonText: this.$t("confirm.cancel").toString(),
                    inputPlaceholder: this.$t("pullImage.repositoryPlaceholder").toString(),
                    inputPattern: ChangeImageDialog.REPOSITORY_PATTERN,
                    inputErrorMessage: this.$t("pullImage.repositoryInvalid").toString(),
                    closeOnClickModal: false,
                }
            );
            return (result as { value: string }).value.trim();
        } catch {
            return undefined;
        }
    }

    @ErrorProxy({ validatForm: "formRef" })
    protected override async onConfirm() {
        const image_addr = this.obj.image_addr == "[customImage]" ? this.obj.custom_image : this.obj.image_addr;
        const selectedImage = this.images.find(x => x.address === image_addr);
        const incompatible = this.data.find(item => !isImageVersionCompatibleByModelVersion(item.create_req?.mobile_model_version, selectedImage?.major_version));
        if (incompatible) {
            throw new Error(this.$t("changeImage.versionMismatch").toString());
        }

        const isHttpImage = /^https?:\/\//i.test(image_addr);
        let pulledRepository: string | undefined;
        if (isHttpImage) {
            if (selectedImage) {
                // 官方 HTTP(S) 镜像：与创建页面一致，由 name 的第一个连字符生成 repository。
                pulledRepository = selectedImage.name.replace("-", ":");
            } else {
                pulledRepository = await this.requestRepository();
                if (!pulledRepository) return;
            }
        }

        if (image_addr && image_addr.includes('.') && image_addr.includes('/')) {
            var gp = this.data.groupBy(x => x.hostIp);
            for (var ip of Object.keys(gp)) {
                var imgs = await deviceApi.getImages(ip);
                var image = imgs.find(x => x.address === image_addr);
                if (!image || !image.download) {
                    const re = await this.$dialog(PullImageDialog).show({
                        hostIp: ip,
                        imageAddress: image_addr,
                        repository: pulledRepository,
                        dockerRegistry: this.obj.docker_registry,
                    });
                    if (re?.canceled) return;
                    if (re?.error) throw new Error(re.error);
                }
            }
        }

        await this.confirming(pulledRepository);
    }

    @Watch("dockerRegistries", { immediate: true })
    onDockerRegistriesChange(list: string[]) {
        if (
            list &&
            list.length > 0 &&
            !this.obj.docker_registry &&
            this.obj.image_addr !== "[customImage]"
        ) {
            this.$set(this.obj, "docker_registry", list[0]);
        }
    }

    @Watch("obj.image_addr")
    onImageAddrChange(newVal: string) {
        if (newVal === "[customImage]") {
            // 选择自定义镜像时，清空镜像加速
            this.$set(this.obj, "docker_registry", "");
        } else if (!this.obj.docker_registry && this.dockerRegistries.length > 0) {
            // 切换回官方镜像且当前为空时，恢复默认值
            this.$set(this.obj, "docker_registry", this.dockerRegistries[0]);
        }
    }

    @ErrorProxy({ success: i18n.t("changeImage.success"), loading: i18n.t("loading") })
    protected async confirming(pulledRepository?: string) {
        var tasks: Promise<void>[] = [];
        let error: any;
        // HTTP(S) 地址仅用于下载，更新接口引用本地 repository；不修改 obj，保持界面选中项不变。
        const image_addr = pulledRepository
            ?? (this.obj.image_addr == "[customImage]" ? this.obj.custom_image : this.obj.image_addr);
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
                <div style="color: red; margin-bottom: 10px;">{this.$t("changeImage.warning")}</div>
                <el-form-item label={this.$t("changeImage.label")} prop="image_addr"  >
                    <ImageSelector2
                        images={this.filteredImages}
                        v-model={this.obj.image_addr} 
                        hasVip={this.hasVip}
                        on={{ "vip-required": () => this.onVipRequired() }}
                    />
                </el-form-item>
                {this.obj.image_addr == "[customImage]" && <el-form-item label={this.$t("customImage")} prop="custom_image">
                    <el-input v-model={this.obj.custom_image} />
                </el-form-item>}

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
                            disabled={this.obj.image_addr === "[customImage]"}
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
                            href={`https://download.hexdeep.com/tools/docker_registry.exe?t=${Date.now()}`}
                            target="_blank"
                        >
                            {this.$t("create.download_docker_registry")}
                        </el-link>
                    </div>
                    {this.obj.image_addr === "[customImage]" && (
                        <div style="color: #909399; font-size: 12px; margin-top: 4px;">
                            {this.$t("create.custom_image_no_registry")}
                        </div>
                    )}
                </el-form-item>

            </el-form>
        );
    }
}
