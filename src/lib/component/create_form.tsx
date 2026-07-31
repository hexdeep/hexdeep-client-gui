import { CreateParam, ImageInfo } from "@/api/device_define";
import { RentalInfo } from "@/api/order_define";
import { Component, Prop, Watch } from "vue-property-decorator";
import * as tsx from 'vue-tsx-support';
import { Row } from '../container';
import "./create_form.less";
import { CreateFormVersionFields } from "./create_form_version_fields";
import { InstanceSlotPicker } from "./instance_slot_picker";
import { CUSTOM_MODEL_VALUE, getOrLoadMobileModelList, MobileModelGroup } from "./mobile_model_loader";
import { S5FormItems } from "./s5_form_items";
import { isImageVersionCompatibleByModelVersion } from "@/common/common";
import Vue, { VNode } from 'vue';

@Component
export class CreateForm extends tsx.Component<IPorps, IEvents, ISlots> {
    @Prop({ default: () => { return []; } }) images!: ImageInfo[];
    @Prop({ default: () => { return []; } }) dockerRegistries!: string[];
    @Prop({ default: () => { return []; } }) rentalRecord!: RentalInfo[];
    @Prop({ default: () => { return []; } }) selectedIndices!: number[];
    @Prop({ default: () => { sandbox_size: 64; } }) data!: CreateParam;
    @Prop({ default: true }) needName!: boolean;
    @Prop({ default: false }) isUpdate!: boolean;
    @Prop({ default: false }) hasVip!: boolean;
    @Prop({ default: false }) isBatchCreate!: boolean;
    @Prop({ default: "" }) ip!: string;

    // 安卓版本用 tab 而非下拉过滤，androidVersion 始终对应当前激活的 tab（见 androidVersionOptions
    // 的 immediate watcher，保证初始就有一个合法值）；此状态仅用于筛选镜像地址列表，不会随创建
    // 请求发往服务器——安卓版本由服务器根据实际选中的镜像地址判断。
    private filterState = Vue.observable({ imageType: 'base', androidVersion: 0 });
    private modelList: MobileModelGroup[] = [];

    // 安卓版本 tab 固定为12/14两项，不再随 images 里实际有哪些版本的镜像变化——服务端可能因该
    // 主机暂无安卓14权限（见 hexdeep_server and14ImageAllowed）而不返回任何安卓14镜像，但老板
    // 希望客户始终能看到安卓14这个入口，即使当前不可用；镜像地址下拉在对应 tab 下为空即可，
    // 真正的可用性拦截交给后端在提交创建/更新请求时报错（见 checkAndroidKernelConflict）。
    private get androidVersionOptions() {
        return [12, 14];
    }

    // 更新流程首次拿到镜像列表时，把 tab/镜像类型默认定位到这台云机当前正在用的镜像上，
    // 避免每次打开更新对话框都被强制拉回“Android 12 / base”——只在第一次生效一次，
    // 之后用户自己切 tab 不会被这里覆盖回去。
    private updateFilterInitialized = false;

    private matchImageType(name?: string): string {
        if (!name) return 'base';
        for (const type of ['magisk', 'gms', 'pine']) {
            if (name.includes(`-${type}-`)) return type;
        }
        return 'base';
    }

    // 安卓版本 tab 没有「全部」项，镜像列表加载完成/变化后，若当前激活版本不在可选列表里
    // （初始值 0，或该版本的镜像已不存在了），自动落到第一个可选版本上，保证 tabs 始终有激活项。
    @Watch("androidVersionOptions", { immediate: true })
    onAndroidVersionOptionsChange(options: number[]) {
        if (options.length === 0) return;
        if (this.isUpdate && !this.updateFilterInitialized) {
            this.updateFilterInitialized = true;
            const current = this.images.find(img => img.address === this.data.image_addr);
            if (current && options.includes(current.android_version)) {
                this.filterState.androidVersion = current.android_version;
                this.filterState.imageType = this.matchImageType(current.name);
                return;
            }
        }
        if (!options.includes(this.filterState.androidVersion)) {
            this.filterState.androidVersion = options[0];
        }
    }

    private getDefaultSubnet(index: number): string {
        return `10.93.${50 + index}.0/24`;
    }

    // 多选实例位时：
    // - bridge 模式下每台云机各自的子网由 CreateDialog 按实例位编号自动生成（复用同一个手填子网会导致
    //   后续创建的容器网络冲突），子网输入框禁用；
    // - mac_vlan 模式下这里填的 IP 视为"第一台云机的IP"，CreateDialog 参考旧批量创建接口
    //   (dc_api/batch_create 的 OffsetIP 逻辑) 按选中顺序自动给后续云机的IP末段递增。
    private get isMultiSelect() {
        return this.selectedIndices.length > 1;
    }

    @Watch("selectedIndices")
    onSelectedIndicesChange(newVal: number[]) {
        if (!this.isBatchCreate && !this.isUpdate && newVal.length === 1) {
            this.$set(this.data, "subnet", this.getDefaultSubnet(newVal[0]));
        }
    }

    protected async created() {
        if (!this.isBatchCreate && !this.isUpdate && !this.data.subnet && this.selectedIndices.length === 1) {
            this.$set(this.data, "subnet", this.getDefaultSubnet(this.selectedIndices[0]));
        }
        if (!this.data.mobile_model_version) {
            this.$set(this.data, "mobile_model_version", "v2");
        }
        // 型号(model_id)选择器不在更新流程展示（改了也不生效，见 CreateFormVersionFields），
        // 机型列表仅创建流程需要拉取
        if (!this.isUpdate) {
            await this.loadModelList();
            this.ensureValidModelSelection();
        }
        this.ensureCompatibleSelectedImage();
    }

    @Watch("dockerRegistries", { immediate: true })
    onDockerRegistriesChange(list: string[]) {
        if (
            list &&
            list.length > 0 &&
            !this.data.docker_registry &&
            this.data.image_addr !== "[customImage]"
        ) {
            this.$set(this.data, "docker_registry", list[0]);
        }
    }

    @Watch("data.image_addr")
    onImageAddrChange(newVal: string) {
        if (newVal === "[customImage]") {
            // 选择自定义镜像时，清空镜像加速
            this.$set(this.data, "docker_registry", "");
        } else if (!this.data.docker_registry && this.dockerRegistries.length > 0) {
            // 切换回官方镜像且当前为空时，恢复默认值
            this.$set(this.data, "docker_registry", this.dockerRegistries[0]);
        }
    }

    // 安卓14容器目前只随v3机型出，选中安卓14筛选后自动切到v3（v2单选框同时被禁用，防止选回去）。
    @Watch("filterState.androidVersion")
    onAndroidVersionFilterChange(newVal: number) {
        if (newVal === 14 && this.data.mobile_model_version !== "v3") {
            this.$set(this.data, "mobile_model_version", "v3");
        }
    }

    @Watch("data.mobile_model_version")
    async onModelVersionChange() {
        if (!this.isUpdate) {
            await this.loadModelList();
            this.ensureValidModelSelection();
        }
        this.ensureCompatibleSelectedImage();
    }

    private get currentModelId() {
        return Number(this.data.model_id ?? 0);
    }

    private get isCustomModelSelected() {
        return this.currentModelId === CUSTOM_MODEL_VALUE;
    }

    private normalizeMobileModelVersion(version?: string) {
        return version === "v3" ? "v3" : "v2";
    }

    private async loadModelList() {
        const version = this.normalizeMobileModelVersion(this.data.mobile_model_version);
        if (this.data.mobile_model_version !== version) {
            this.$set(this.data, "mobile_model_version", version);
        }
        try {
            this.modelList = await getOrLoadMobileModelList(version, (key) => this.$t(key).toString());
        } catch (e) {
            this.modelList = [];
        }
    }

    private hasModelValue(value: number) {
        return this.modelList.some(group => group.options.some(option => option.value === value));
    }

    private ensureValidModelSelection() {
        if (this.isUpdate || this.isCustomModelSelected) {
            return;
        }
        // 随机由后端完成，model_id<=0 保持「随机」即可，不再前端预抽具体机型。
        // 仅当指定的具体机型在当前版本机型列表中不存在时，回退为随机(0)。
        if (this.currentModelId > 0 && !this.hasModelValue(this.currentModelId)) {
            this.$set(this.data, "model_id", 0);
        }
    }

    // 带信息图标 + 悬停提示的表单项标签
    private labelWithTip(label: string, tip: string): VNode {
        return (
            <span>
                {label}
                <el-tooltip content={tip} placement="top" effect="dark" transition="">
                    <i class="el-icon-info" style="margin-left: 4px; color: #909399; cursor: help;"></i>
                </el-tooltip>
            </span>
        );
    }

    private fixNumber(key: string) {
        return (e: Event) => {
            const target = e.target as HTMLInputElement;
            // x_dpi/y_dpi/offset 允许留空：x_dpi/y_dpi 由后端处理空值，offset 留空则随机开机时间
            if ((key === "x_dpi" || key === "y_dpi" || key === "offset") && target.value.trim() === "") {
                this.$set(this.data, key, undefined);
                return;
            }
            let val = Number(target.value);
            let min = Number(target.min);
            let max = Number(target.max);
            if (val < min) val = min;
            if (val > max) val = max;
            if (key === "x_dpi" || key === "y_dpi") {
                val = this.roundDpi(val);
            }
            this.$set(this.data, key, val);
        };
    }

    private roundDpi(value: number) {
        return Math.round(value * 1000) / 1000;
    }

    private ensureCompatibleSelectedImage() {
        if (!this.data.image_addr || this.data.image_addr === "[customImage]") {
            return;
        }
        const selectedImage = this.images.find(img => img.address === this.data.image_addr);
        if (!isImageVersionCompatibleByModelVersion(this.data.mobile_model_version, selectedImage?.major_version)) {
            this.$set(this.data, "image_addr", "");
        }
    }

    public render() {
        return (
            <div>
                {this.$scopedSlots.default ? this.$scopedSlots.default() : ""}
                {this.needName && this.isUpdate && (
                    <el-form-item label={this.$t("create.name")} prop="name">
                        <el-input v-model={this.data.name} maxlength={20} />
                    </el-form-item>
                )}

                {this.needName && !this.isUpdate && (
                    <el-form-item label={this.$t("create.slots")} prop="index">
                        <InstanceSlotPicker
                            value={this.selectedIndices}
                            rentalRecord={this.rentalRecord}
                            on={{ input: (v: number[]) => this.$emit("update:selectedIndices", v) }}
                        />
                    </el-form-item>
                )}

                {!this.isUpdate && (
                    <Row>
                        {this.needName && (
                            <el-form-item label={this.$t("create.name")} prop="name">
                                <el-input v-model={this.data.name} maxlength={20} />
                            </el-form-item>
                        )}

                        <el-form-item label={this.$t("create.sandbox")} prop="sandbox" style="width: 300px" scopedSlots={{ label: () => this.labelWithTip(this.$t("create.sandbox") as string, this.$t("create.sandbox_tip") as string) }}>
                            <el-switch v-model={this.data.sandbox} active-value={1} inactive-value={0} />
                        </el-form-item>

                        <el-form-item label={this.$t("create.sandbox_size")} prop="sandbox_size" label-width="120px" required={this.data.sandbox == 1}>
                            <el-input v-model={this.data.sandbox_size} type="number" disabled={this.data.sandbox != 1} />
                        </el-form-item>
                    </Row>
                )}

                <el-form-item label={this.$t("create.subnet")} prop="subnet" >
                    <el-input v-model={this.data.subnet} disabled={this.data.mac_vlan == 1 || this.isMultiSelect} />
                </el-form-item>

                <Row>
                    <el-form-item label={this.$t("create.mac_vlan")} prop="mac_vlan" style="flex: 0 0 auto; width: auto;">
                        <el-switch v-model={this.data.mac_vlan} active-value={1} inactive-value={0} />
                    </el-form-item>

                    <el-form-item
                        label={this.$t("create.ip")}
                        prop="ip"
                        label-width="40px"
                        style="flex: 1 1 0; width: auto;"
                        scopedSlots={this.isMultiSelect && this.data.mac_vlan == 1 ? {
                            label: () => this.labelWithTip(this.$t("create.ip") as string, this.$t("create.ipMultiTip") as string)
                        } : undefined}
                    >
                        <el-input v-model={this.data.ip} disabled={this.data.mac_vlan != 1} />
                    </el-form-item>

                    <el-form-item
                        label={this.$t("create.dns_urls")}
                        prop="dns_urls"
                        style="flex: 2 1 0; width: auto;"
                        scopedSlots={{ label: () => this.labelWithTip(this.$t("create.dns_urls") as string, this.$t("create.dns_urls_tip") as string) }}
                    >
                        <el-input v-model={this.data.dns_urls} />
                    </el-form-item>
                </Row>

                {/* 安卓版本用 tab 切换，仅机型版本/型号、镜像类型、镜像地址这三行随安卓版本变化，
                    封装在 CreateFormVersionFields 里，两个 tab 各实例化一份，各自按该版本过滤镜像列表；
                    其余表单项（自定义机型路径/镜像加速/分辨率/DPI/DNS 等）与安卓版本无关，不纳入 tab 管理。
                    更新流程也允许改机型版本/机型/镜像，因此这里不再按 isUpdate 隐藏。
                    安卓14 tab 不在前端预先禁用/探测宿主机是否支持——老板希望客户始终能看到安卓14
                    镜像，即使当前宿主机暂不能用；宿主机不支持时由后端在提交创建/更新请求时报错拦截
                    （见 super_sdk docker_handler.go 的 checkAndroidKernelConflict）。 */}
                <el-tabs
                    class="brand-tabs ml-4 mb-4"
                    type="border-card"
                    value={String(this.filterState.androidVersion)}
                    onInput={(v: string) => { this.filterState.androidVersion = Number(v); }}
                >
                    {this.androidVersionOptions.map(version => (
                        <el-tab-pane
                            key={version}
                            name={String(version)}
                            label={`Android ${version}`}
                            lazy
                        >
                            <CreateFormVersionFields
                                data={this.data}
                                filterState={this.filterState}
                                images={this.images}
                                androidVersion={version}
                                hasVip={this.hasVip}
                                ip={this.ip}
                                isUpdate={this.isUpdate}
                                on={{ "vip-required": () => this.$emit("vip-required") }}
                            />
                        </el-tab-pane>
                    ))}
                </el-tabs>

                <Row>
                    <el-form-item label={this.$t("create.width")} prop="width" label-width="60px">
                        <el-input class="no-number-spinner" v-model={this.data.width} onBlur={this.fixNumber("width")} min={600} max={4000} type="number" />
                    </el-form-item>
                    <el-form-item label={this.$t("create.height")} prop="height" label-width="60px">
                        <el-input class="no-number-spinner" v-model={this.data.height} onBlur={this.fixNumber("height")} min={600} max={4000} type="number" />
                    </el-form-item>
                    <el-form-item label={this.$t("create.fps")} prop="fps" label-width="70px" scopedSlots={{ label: () => this.labelWithTip(this.$t("create.fps") as string, this.$t("create.fps_tip") as string) }}>
                        <el-input class="no-number-spinner" v-model={this.data.fps} onBlur={this.fixNumber("fps")} min={10} max={60} type="number" />
                    </el-form-item>
                    <el-form-item label={this.$t("create.dpi")} prop="dpi" label-width="50px">
                        <el-input class="no-number-spinner" v-model={this.data.dpi} onBlur={this.fixNumber("dpi")} min={100} max={600} type="number" />
                    </el-form-item>
                    <el-form-item label={this.$t("create.x_dpi")} prop="x_dpi" label-width="65px" scopedSlots={{ label: () => this.labelWithTip(this.$t("create.x_dpi") as string, this.$t("create.dpi_axis_tip") as string) }}>
                        <el-input class="no-number-spinner" v-model={this.data.x_dpi} onBlur={this.fixNumber("x_dpi")} min={100} max={600} step={0.001} type="number" />
                    </el-form-item>
                    <el-form-item label={this.$t("create.y_dpi")} prop="y_dpi" label-width="65px" scopedSlots={{ label: () => this.labelWithTip(this.$t("create.y_dpi") as string, this.$t("create.dpi_axis_tip") as string) }}>
                        <el-input class="no-number-spinner" v-model={this.data.y_dpi} onBlur={this.fixNumber("y_dpi")} min={100} max={600} step={0.001} type="number" />
                    </el-form-item>
                </Row>

                <el-form-item
                    label={this.$t("create.docker_registry")}
                    prop="docker_registry"
                >
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <el-select
                            v-model={this.data.docker_registry}
                            placeholder={this.$t("create.select_docker_registry")}
                            filterable
                            allow-create
                            clearable
                            disabled={this.data.image_addr === "[customImage]"}
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
                    {this.data.image_addr === "[customImage]" && (
                        <div style="color: #909399; font-size: 12px; margin-top: 4px;">
                            {this.$t("create.custom_image_no_registry")}
                        </div>
                    )}
                </el-form-item>

                {/* 老板说先不做界面：开机时长(offset)输入框暂时注释掉，仅隐藏 UI，其余 JS 逻辑(类型/fixNumber 空值处理/请求透传)保持不变 */}
                {/* <el-form-item label={this.$t("create.offset")} prop="offset" scopedSlots={{ label: () => this.labelWithTip(this.$t("create.offset") as string, this.$t("create.offset_tip") as string) }}>
                    <el-input class="no-number-spinner" v-model={this.data.offset} onBlur={this.fixNumber("offset")} min={0} type="number" placeholder={this.$t("create.offset_placeholder") as string} />
                </el-form-item> */}

                {/* {!this.isUpdate && <S5FormItems v-model={this.data}></S5FormItems>} */}
            </div>
        );

    }
}

interface ISlots {
    default: void;
}
interface IPorps {
    data?: CreateParam;
    needName?: boolean;
    images?: ImageInfo[];
    dockerRegistries: string[];
    rentalRecord?: RentalInfo[];
    selectedIndices?: number[];
    isUpdate?: boolean;
    hasVip?: boolean;
    isBatchCreate?: boolean;
    ip?: string;
}

interface IEvents {
    onVipRequired: () => void;
    "onUpdate:selectedIndices": (v: number[]) => void;
}
