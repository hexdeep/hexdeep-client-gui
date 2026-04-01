

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
import { timeDiff } from "@/common/common";

@Dialog
export class ChangeImageDialog extends CommonDialog<DeviceInfo[], boolean> {
    protected images: ImageInfo[] = [];
    protected dockerRegistries: string[] = [];
    protected obj = { image_addr: "", custom_image: "", docker_registry: "" };
    protected hasVip = false; // 当前主机是否已开通VIP
    protected allHosts: HostInfo[] = []; // 所有主机列表
    
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
                <div style="color: red; margin-bottom: 10px;">{this.$t("changeImage.warning")}</div>
                <el-form-item label={this.$t("changeImage.label")} prop="image_addr"  >
                    <ImageSelector2 
                        images={this.images} 
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
                            href={`https://download.hexdeep.com/super_sdk/docker_registry.exe?t=${Date.now()}`}
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
