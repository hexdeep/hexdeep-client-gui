import { deviceApi } from '@/api/device_api';
import { orderApi } from "@/api/order_api";
import { CreateParam, CreatedVmInfo, DockerEditParam, HostInfo, ImageInfo, TreeConfig } from "@/api/device_define";
import { RentalInfo } from "@/api/order_define";
import { i18n } from "@/i18n/i18n";
import { getSuffixName, isImageVersionCompatibleByModelVersion, normalizeMobileModelVersion, timeDiff } from '@/common/common';
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { Watch } from "vue-property-decorator";
import { CreateForm } from "../../../lib/component/create_form";
import { normalizeModelSubmitFields } from "@/lib/component/mobile_model_loader";
import { CreateFailureItem, CreateFailuresDialog } from './create_failures';
import { PullImageDialog } from './pull_image';
import { VipHostSelectDialog } from "./vip_host_select";

@Dialog
export class CreateDialog extends CommonDialog<DockerEditParam, CreateParam> {
    public override width: string = "800px";
    protected images: ImageInfo[] = [];
    private dockerRegistries: string[] = [];
    private rentalRecord: RentalInfo[] = [];
    private occupiedIndices: number[] = [];
    private selectedIndices: number[] = [];
    private dirty = 0;
    public override allowEscape: boolean = false;
    private hasVip = false;
    private allHosts: HostInfo[] = [];

    private static readonly CACHE_KEY = "CreateFormCache";
    private static readonly CACHE_FIELDS = ["name", "sandbox_size", "width", "height", "dpi", "x_dpi", "y_dpi", "fps", "mobile_model_version", "mobile_model_source", "model_id", "model_manufacturer"] as const;

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
        this.occupiedIndices = data.occupiedIndices ?? [];
        if (!data.isUpdate) {
            this.loadCachedValues();
            // 实例位多选仅创建流程需要，更新流程不展示该字段，跳过 getRental 请求
            await this.loadRentalRecord();
        }
        // 检查VIP状态
        this.checkVipStatus();
        // 主机列表仅在用户触发 VIP 购买引导时才需要，交给 onVipRequired 按需拉取
        return super.show(data);
    }

    private async checkVipStatus() {
        try {
            const hostId = this.data.hostId;
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

    private loadCachedValues() {
        try {
            const cached = localStorage.getItem(CreateDialog.CACHE_KEY);
            if (!cached) return;
            const values = JSON.parse(cached);
            if (values.mobile_model_version === "v1") {
                values.mobile_model_version = "v2";
            }
            for (const field of CreateDialog.CACHE_FIELDS) {
                if (values[field] !== undefined && values[field] !== null) {
                    (this.data.obj as any)[field] = values[field];
                }
            }
        } catch (e) {
            console.warn("Failed to load create cache:", e);
        }
    }

    private saveCacheValues() {
        try {
            const values: Record<string, any> = {};
            for (const field of CreateDialog.CACHE_FIELDS) {
                values[field] = (this.data.obj as any)[field];
            }
            localStorage.setItem(CreateDialog.CACHE_KEY, JSON.stringify(values));
        } catch (e) {
            console.warn("Failed to save create cache:", e);
        }
    }

    private async onVipRequired() {
        if (this.allHosts.length === 0) {
            this.allHosts = await deviceApi.getHosts();
        }
        const currentHost = this.allHosts.find(h => h.device_id === this.data.hostId);
        const result = await this.$dialog(VipHostSelectDialog).show({
            hosts: this.allHosts,
            currentHost: currentHost
        });
        if (result) {
            await this.checkVipStatus();
        }
    }

    @Watch("data", { deep: true })
    protected onDataChange() {
        this.dirty++;
    }

    protected async loadRentalRecord() {
        const record = await orderApi.getRental(this.data.hostId) || [];
        this.rentalRecord = record.length > 0 ? record.first.device_indexes : [];
    }

    @ErrorProxy({ validatForm: "formRef" })
    protected override async onConfirm() {
        const normalizedModelVersion = this.data.isUpdate
            ? normalizeMobileModelVersion(this.data.info.create_req?.mobile_model_version)
            : normalizeMobileModelVersion(this.data.obj.mobile_model_version);

        if (this.data.isUpdate) {
            if (this.dirty < 2) {
                this.close();
                return;
            }
        } else if (this.selectedIndices.length === 0) {
            throw new Error(this.$t("create.needSelectSlot").toString());
        }
        const image_addr = this.data.obj.image_addr == "[customImage]" ? this.data.obj.custom_image : this.data.obj.image_addr;
        var image = this.images.find(x => x.address == image_addr);
        if (!isImageVersionCompatibleByModelVersion(normalizedModelVersion, image?.major_version)) {
            throw new Error(this.$t("changeImage.versionMismatch").toString());
        }
        if (image_addr && ((image_addr.includes('.') && image_addr.includes('/')))) {
            if (!image || !image.download) {
                const err = await this.$dialog(PullImageDialog).show({
                    hostIp: this.data.info.hostIp,
                    imageAddress: image_addr!,
                    dockerRegistry: this.data.obj.docker_registry,
                });
                if (err) throw err;
            }
        }
        if (!this.data.isUpdate) {
            this.saveCacheValues();
        }
        this.confirming();
    }

    private static getDefaultSubnet(index: number): string {
        return `10.93.${50 + index}.0/24`;
    }

    // 与后端 util/ip_util.go 的 OffsetIP 保持一致：mac_vlan 多选创建时，单台创建接口不会像
    // dc_api/batch_create 那样自动按顺序偏移IP，需要前端自己按相同规则算好每台的IP再提交。
    private static offsetIp(startIp: string, offset: number): string {
        if (offset <= 0 || !startIp) return startIp;
        const parts = startIp.split(".");
        if (parts.length !== 4) return startIp;
        const lastByte = parseInt(parts[3], 10);
        if (isNaN(lastByte)) return startIp;
        let newLastByte = lastByte + offset;
        if (newLastByte > 254) {
            newLastByte = 2 + (newLastByte - 255);
        }
        return `${parts[0]}.${parts[1]}.${parts[2]}.${newLastByte}`;
    }

    @ErrorProxy({ success: i18n.t("success"), loading: i18n.t("loading") })
    protected async confirming() {
        if (this.data.isUpdate) {
            const data = Object.assign({}, this.data);
            data.obj = Object.assign({}, this.data.obj);
            data.obj.mobile_model_version = normalizeMobileModelVersion(data.obj.mobile_model_version);
            if (data.obj.image_addr === "[customImage]") {
                data.obj.image_addr = data.obj.custom_image;
                delete data.obj.custom_image;
            } else {
                delete data.obj.custom_image;
            }
            normalizeModelSubmitFields(data.obj);
            await deviceApi.update(data);
            this.close(data.obj);
            return;
        }

        // 创建流程：按选中的实例位循环创建，逐个收集成功/失败结果
        const isMulti = this.selectedIndices.length > 1;
        const baseObj = Object.assign({}, this.data.obj);
        baseObj.mobile_model_version = normalizeMobileModelVersion(baseObj.mobile_model_version);
        if (baseObj.image_addr === "[customImage]") {
            baseObj.image_addr = baseObj.custom_image;
            delete baseObj.custom_image;
        } else {
            delete baseObj.custom_image;
        }
        normalizeModelSubmitFields(baseObj);

        const baseName = this.data.obj.name;
        const createdVms: CreatedVmInfo[] = [];
        const failures: CreateFailureItem[] = [];
        // 按实例位编号升序排列后再逐个创建，偏移量 j 是"选中实例位里的第几个"（0-based），
        // 与旧批量创建接口 dc_api/batch_create 里 `for j, i := range indexes` 的语义保持一致
        const sortedIndices = [...this.selectedIndices].sort((a, b) => a - b);

        for (let j = 0; j < sortedIndices.length; j++) {
            const index = sortedIndices[j];
            const obj = Object.assign({}, baseObj);
            obj.index = index;
            obj.name = isMulti ? `${baseName}_${index}` : baseName;
            if (isMulti) {
                if (baseObj.mac_vlan == 1) {
                    // mac_vlan 模式：参照旧批量创建的 OffsetIP 规则，按顺序递增末段
                    obj.ip = CreateDialog.offsetIp(baseObj.ip ?? "", j);
                } else {
                    // bridge 模式：每台云机各自的子网必须不同，否则第二台起创建网络会冲突
                    obj.subnet = CreateDialog.getDefaultSubnet(index);
                }
            }
            try {
                await deviceApi.create({ info: this.data.info, hostId: this.data.hostId, obj });
                createdVms.push({ index, name: obj.name! });
            } catch (e: any) {
                failures.push({ index, name: obj.name!, message: e?.message ?? String(e) });
            }
        }

        if (createdVms.length > 0) {
            this.addCreatedVmsToTreeConfig(createdVms);
        }

        if (failures.length > 0) {
            await this.$dialog(CreateFailuresDialog).show({ failures });
            if (createdVms.length > 0) {
                this.close(this.data.obj);
            }
            // 存在失败项：不弹通用成功提示（失败详情已经用专门弹窗展示过了）
            return false;
        }

        // 全部创建成功，询问是否立即启动
        const re = await this.$confirm(
            this.$t(isMulti ? "create.startMulti" : "create.start").toString(),
            this.$t("confirm.title").toString(),
            {
                confirmButtonText: this.$t("confirm.ok").toString(),
                cancelButtonText: this.$t("confirm.cancel").toString(),
                type: "warning",
            }
        ).catch(() => "cancel");
        if (re == "confirm") {
            await Promise.allSettled(createdVms.map(vm =>
                deviceApi.start(this.data.info.hostIp, `${this.data.hostId}_${vm.index}_${vm.name}`)
            ));
        }
        this.close(this.data.obj);
    }

    // 将新创建的云机加入 TreeConfig 并设为选中
    private addCreatedVmsToTreeConfig(createdVms: CreatedVmInfo[]) {
        try {
            const str = localStorage.getItem("TreeConfig") || "[]";
            const treeConfig: TreeConfig[] = JSON.parse(str);
            const hostIp = this.data.info.hostIp;
            const hostId = this.data.hostId || "";

            createdVms.forEach(vm => {
                const key = `${hostIp}-${vm.index}-${hostId}_${vm.index}_${vm.name}`;
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
            width: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
            ],
            height: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
            ],
            fps: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
            ],
            dpi: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
            ],
            model_id: [
                { required: true, message: i18n.t("notNull"), trigger: 'change' },
            ],
            ip: [
                { required: this.data.obj.mac_vlan == 1, message: i18n.t("notNull"), trigger: 'blur' },
                { pattern: /^((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})(\.((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})){3}$/, message: i18n.t("invalidIp"), trigger: 'blur' },
            ],
            subnet: [
                { pattern: /^((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})(\.((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})){3}\/([0-9]|[1-2][0-9]|3[0-2])$/, message: i18n.t("invalidSubnet"), trigger: 'blur' },
            ],
            dns_urls: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
                { pattern: /^(((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})(\.((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})){3})(,((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})(\.((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})){3})*$/, message: i18n.t("invalidDnsUrls"), trigger: 'blur' },
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
            ],
            // 自定义机型来源可留空（留空表示由后端随机选取一个自定义机型），故不再强制必填
        };
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this.data.obj }} rules={this.formRules} label-width="150px">
                {this.data.isUpdate && <div style="color: red; margin-bottom: 10px; margin-left: 140px;">{this.$t("changeImage.warning")}</div>}
                <CreateForm
                    data={this.data.obj}
                    images={this.images}
                    dockerRegistries={this.dockerRegistries}
                    rentalRecord={this.rentalRecord}
                    occupiedIndices={this.occupiedIndices}
                    selectedIndices={this.selectedIndices}
                    isUpdate={this.data.isUpdate}
                    hasVip={this.hasVip}
                    ip={this.data.info.hostIp}
                    on={{
                        "vip-required": () => this.onVipRequired(),
                        "update:selectedIndices": (v: number[]) => { this.selectedIndices = v; },
                    }}
                ></CreateForm>
            </el-form>
        );
    }
}
