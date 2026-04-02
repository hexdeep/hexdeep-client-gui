

import { deviceApi } from '@/api/device_api';
import { DockerBatchCreateParam, HostInfo, ImageInfo, MyConfig, TreeConfig, CreatedVmInfo } from "@/api/device_define";
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
import { VipHostSelectDialog } from "./vip_host_select";
import { orderApi } from "@/api/order_api";
import { timeDiff } from "@/common/common";


@Dialog
export class BatchCreateDialog extends CommonDialog<DockerBatchCreateParam, boolean> {
    @InjectReactive() private config!: MyConfig;
    public override width: string = "650px";
    protected images: ImageInfo[] = [];
    private dockerRegistries: string[] = [];
    public override allowEscape: boolean = false;
    protected hasVip = false; // 当前主机是否已开通VIP
    protected allHosts: HostInfo[] = []; // 所有主机列表

    public override show(data: DockerBatchCreateParam) {
        this.data = data;
        this.title = `${i18n.t("batchCreateVm")} ${data.hostIp.join(",")}`;
        deviceApi.getImages(this.data.hostIp.first).then((images) => {
            this.images = images;
        });
        deviceApi.getDockerRegistries(this.data.hostIp.first).then((list) => {
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
            const hostId = this.data.hostId?.first;
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
        const currentHost = this.allHosts.find(h => h.device_id === this.data.hostId?.first);
        const result = await this.$dialog(VipHostSelectDialog).show({
            hosts: this.allHosts,
            currentHost: currentHost
        });
        if (result) {
            // 用户完成了购买或试用，重新检查VIP状态
            await this.checkVipStatus();
        }
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
                        dockerRegistry: this.data.obj.docker_registry,
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
        const createdVms: CreatedVmInfo[] = [];
        
        for (const ip of this.data.hostIp) {
            const obj = Object.assign({}, this.data.obj);
            if (obj.image_addr === "[customImage]") {
                obj.image_addr = obj.custom_image;
                delete obj.custom_image;
            } else {
                delete obj.custom_image;
            }
            try {
                const result = await deviceApi.batchCreate(ip, this.data.obj.num!, this.data.obj.suffix_name!, obj);
                // 收集创建成功的云机信息
                if (result.created && result.created.length > 0) {
                    result.created.forEach(vm => {
                        createdVms.push({
                            index: vm.index,
                            name: vm.name,
                        });
                    });
                }
            } catch (e) {
                console.log(e);
            }
        }
        
        // 将新创建的云机加入 TreeConfig 并设为选中
        if (createdVms.length > 0) {
            this.addCreatedVmsToTreeConfig(createdVms);
        }
        
        this.close(true);
    }

    // 将新创建的云机加入 TreeConfig
    private addCreatedVmsToTreeConfig(createdVms: CreatedVmInfo[]) {
        try {
            const str = localStorage.getItem("TreeConfig") || "[]";
            const treeConfig: TreeConfig[] = JSON.parse(str);
            
            // 为每个新创建的云机生成 key 并添加到配置
            // key 格式: ${hostIp}-${index}-${name}
            createdVms.forEach(vm => {
                const hostIp = this.data.hostIp[0]; // 批量创建时只有一个 hostIp
                const key = `${hostIp}-${vm.index}-${vm.name}`;
                
                // 检查是否已存在，避免重复
                if (!treeConfig.find(t => t.key === key)) {
                    treeConfig.push({
                        key: key,
                        selected: true,
                        opened: false,
                    });
                }
            });
            
            localStorage.setItem("TreeConfig", JSON.stringify(treeConfig));
        } catch (e) {
            console.warn("Failed to update TreeConfig:", e);
        }
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
            ],
            subnet: [
                { pattern: /^((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})(\.((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})){3}\/([0-9]|[1-2][0-9]|3[0-2])$/, message: i18n.t("invalidSubnet"), trigger: 'blur' },
            ],
            dns_urls: [
                { pattern: /^(((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})(\.((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})){3})(,((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})(\.((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})){3})*$/, message: i18n.t("invalidDnsUrls"), trigger: 'blur' },
            ]
        };
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this.data.obj }} rules={this.formRules} label-width="150px" class={s.form}>
                <div class={s.tip}>{this.$t("create.tip", { 0: this.data.maxNum })}</div>
                <CreateForm data={this.data.obj} needName={false} images={this.images} dockerRegistries={this.dockerRegistries} validIndex={0} validInstance={[]} hasVip={this.hasVip} on={{ "vip-required": () => this.onVipRequired() }}>
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
