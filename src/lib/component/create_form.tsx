import { deviceApi } from "@/api/device_api";
import { CreateParam, ImageInfo, MobileModelDimensions } from "@/api/device_define";
import { RentalInfo } from "@/api/order_define";
import { Component, Prop, Watch } from "vue-property-decorator";
import * as tsx from 'vue-tsx-support';
import { Row } from '../container';
import "./create_form.less";
import { ImageSelector2 } from "./image_selector2";
import { InstanceSlotPicker } from "./instance_slot_picker";
import { ModelSelector } from "./model_selector";
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

    // androidVersion=0 表示不过滤（默认，兼容老行为）；此过滤仅用于筛选下方镜像地址下拉框的
    // 选项，不会随创建请求发往服务器——安卓版本由服务器根据实际选中的镜像地址判断。
    private filterState = Vue.observable({ imageType: 'base', androidVersion: 0 });
    private modelList: MobileModelGroup[] = [];

    // 宿主机内核是否支持Android 14容器（/proc/version 第三行 android=0或14），由 super_sdk
    // 的 /dc_api/check_android14_support 接口探测；接口不存在或探测失败时按“不支持”处理。
    private hostSupportsAndroid14 = false;

    private async loadHostAndroid14Support() {
        this.hostSupportsAndroid14 = await deviceApi.checkAndroid14Support(this.ip);
    }

    // 当前阶段仅安卓14是内测版本，其余全是安卓12，因此只在镜像列表里确实存在安卓14镜像、
    // 并且宿主机内核也支持运行Android 14容器时，才展示"安卓版本"选择器——两个条件缺一不可：
    // 有14的镜像但内核不支持时选了也创建不出来，内核支持但没有14镜像时选择器没有意义。
    private get showAndroidVersionFilter() {
        return this.hostSupportsAndroid14 && this.images.some(img => img.android_version === 14);
    }

    private get androidVersionOptions() {
        const versions = new Set(this.images.map(img => img.android_version).filter(v => !!v));
        return Array.from(versions).sort((a, b) => a - b);
    }

    private get filteredImages() {
        const type = this.filterState.imageType;
        const byType = type === 'all'
            ? this.images
            : this.images.filter(img => img.name && img.name.includes(`-${type}-`));

        const byAndroidVersion = this.filterState.androidVersion === 0
            ? byType
            : byType.filter(img => img.android_version === this.filterState.androidVersion);

        return byAndroidVersion.filter(img => isImageVersionCompatibleByModelVersion(this.data.mobile_model_version, img.major_version));
    }

    private inputNumber(key: string, min: number, max: number) {
        return (v: string) => {
            let val = Number(v);
            if (val < min) val = min;
            if (val > max) val = max;
            this.$set(this.data, key, val);
        };
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
        this.loadHostAndroid14Support();
        if (!this.isBatchCreate && !this.isUpdate && !this.data.subnet && this.selectedIndices.length === 1) {
            this.$set(this.data, "subnet", this.getDefaultSubnet(this.selectedIndices[0]));
        }
        if (!this.data.mobile_model_version) {
            this.$set(this.data, "mobile_model_version", "v2");
        }
        // 机型选择器仅创建流程展示，更新流程不需要拉取机型列表
        if (!this.isUpdate) {
            await this.loadModelList();
            this.ensureValidModelSelection();
        }
        this.ensureCompatibleSelectedImage();
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

    private applyModelDimensions(meta: MobileModelDimensions) {
        this.$set(this.data, "width", meta.screen_width);
        this.$set(this.data, "height", meta.screen_height);
        this.$set(this.data, "dpi", meta.screen_density);
        if (meta.screen_xdpi !== undefined) {
            this.$set(this.data, "x_dpi", this.roundDpi(meta.screen_xdpi));
        }
        if (meta.screen_ydpi !== undefined) {
            this.$set(this.data, "y_dpi", this.roundDpi(meta.screen_ydpi));
        }
    }

    private roundDpi(value: number) {
        return Math.round(value * 1000) / 1000;
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

    // 用户在机型对话框点击「覆盖到表单」后，才用机型屏幕参数覆盖当前表单
    private onApplyDimensions(meta?: MobileModelDimensions) {
        if (meta) {
            this.applyModelDimensions(meta);
        }
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

                        <el-form-item label={this.$t("create.sandbox")} prop="sandbox" scopedSlots={{ label: () => this.labelWithTip(this.$t("create.sandbox") as string, this.$t("create.sandbox_tip") as string) }}>
                            <el-switch v-model={this.data.sandbox} active-value={1} inactive-value={0} />
                        </el-form-item>

                        <el-form-item label={this.$t("create.sandbox_size")} prop="sandbox_size" required={this.data.sandbox == 1}>
                            <el-input v-model={this.data.sandbox_size} type="number" disabled={this.data.sandbox != 1} />
                        </el-form-item>
                    </Row>
                )}

                <el-form-item label={this.$t("create.subnet")} prop="subnet" >
                    <el-input v-model={this.data.subnet} disabled={this.data.mac_vlan == 1 || this.isMultiSelect} />
                </el-form-item>

                <Row>
                    <el-form-item label={this.$t("create.mac_vlan")} prop="mac_vlan">
                        <el-switch v-model={this.data.mac_vlan} active-value={1} inactive-value={0} />
                    </el-form-item>

                    <el-form-item
                        label={this.$t("create.ip")}
                        prop="ip"
                        scopedSlots={this.isMultiSelect && this.data.mac_vlan == 1 ? {
                            label: () => this.labelWithTip(this.$t("create.ip") as string, this.$t("create.ipMultiTip") as string)
                        } : undefined}
                    >
                        <el-input v-model={this.data.ip} disabled={this.data.mac_vlan != 1} />
                    </el-form-item>
                </Row>

                {!this.isUpdate && (
                    <Row>
                        <el-form-item label={this.$t("create.mobile_model_version")} prop="mobile_model_version">
                            <el-radio-group v-model={this.data.mobile_model_version}>
                                {/* 安卓14镜像依赖v3机型，选中安卓14时禁止切回v2，见 onAndroidVersionFilterChange */}
                                <el-radio label="v2" disabled={this.filterState.androidVersion === 14}>v2</el-radio>
                                {/* v3 暂未完成，先隐藏 */}
                                <el-radio label="v3">v3</el-radio>
                            </el-radio-group>
                        </el-form-item>
                        <el-form-item label={this.$t("create.model_id")} prop="model_id"  >
                            <ModelSelector
                                v-model={this.data.model_id}
                                version={this.data.mobile_model_version || "v2"}
                                ip={this.ip}
                                source={this.data.mobile_model_source}
                                manufacturer={this.data.model_manufacturer}
                                on={{
                                    "update:source": (v: string) => this.$set(this.data, "mobile_model_source", v),
                                    "update:manufacturer": (v: string) => this.$set(this.data, "model_manufacturer", v),
                                    "apply-dimensions": this.onApplyDimensions
                                }}
                            />
                        </el-form-item>
                    </Row>
                )}

                {!this.isUpdate && this.isCustomModelSelected && (
                    <el-form-item label={this.$t("create.custom_model_path")} prop="mobile_model_source">
                        <el-input
                            v-model={this.data.mobile_model_source}
                            placeholder={this.$t("create.custom_model_path_placeholder")}
                        />
                    </el-form-item>
                )}

                {!this.isUpdate && this.showAndroidVersionFilter && (
                    <el-form-item label={this.$t("create.androidVersion")}>
                        <el-radio-group v-model={this.filterState.androidVersion}>
                            <el-radio label={0}>{this.$t("create.androidVersionAll")}</el-radio>
                            {this.androidVersionOptions.map(version => (
                                <el-radio key={version} label={version}>{`Android ${version}`}</el-radio>
                            ))}
                        </el-radio-group>
                    </el-form-item>
                )}

                <el-form-item label={this.$t("create.image_type")}>
                    <el-radio-group v-model={this.filterState.imageType}>
                        {/*<el-radio label="all">{this.$t("create.image_type_all")}</el-radio>*/}
                        <el-radio label="base">{this.$t("create.image_type_base")}</el-radio>
                        <el-radio label="magisk">{this.$t("create.image_type_magisk")}</el-radio>
                        <el-radio label="gms">{this.$t("create.image_type_gms")}</el-radio>
                        <el-radio label="pine">{this.$t("create.image_type_pine")}</el-radio>
                    </el-radio-group>
                </el-form-item>

                <el-form-item label={this.$t("create.image_addr")} prop="image_addr">
                    <ImageSelector2
                        images={this.filteredImages}
                        v-model={this.data.image_addr}
                        showCustom={this.filterState.imageType === 'base'}
                        hasVip={this.hasVip}
                        on={{ "vip-required": () => this.$emit("vip-required") }}
                    />
                </el-form-item>
                {this.data.image_addr == "[customImage]" && (
                    <el-form-item label={this.$t("customImage")} prop="custom_image">
                        <el-input v-model={this.data.custom_image} />
                    </el-form-item>
                )}

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

                <Row>
                    <el-form-item label={this.$t("create.width")} prop="width">
                        <el-input v-model={this.data.width} onBlur={this.fixNumber("width")} min={600} max={4000} type="number" />
                    </el-form-item>
                    <el-form-item label={this.$t("create.height")} prop="height">
                        <el-input v-model={this.data.height} onBlur={this.fixNumber("height")} min={600} max={4000} type="number" />
                    </el-form-item>
                    <el-form-item label={this.$t("create.fps")} prop="fps" scopedSlots={{ label: () => this.labelWithTip(this.$t("create.fps") as string, this.$t("create.fps_tip") as string) }}>
                        <el-input v-model={this.data.fps} onBlur={this.fixNumber("fps")} min={10} max={60} type="number" />
                    </el-form-item>
                </Row>

                <Row>
                    <el-form-item label={this.$t("create.dpi")} prop="dpi">
                        <el-input v-model={this.data.dpi} onBlur={this.fixNumber("dpi")} min={100} max={600} type="number" />
                    </el-form-item>
                    <el-form-item label={this.$t("create.x_dpi")} prop="x_dpi" scopedSlots={{ label: () => this.labelWithTip(this.$t("create.x_dpi") as string, this.$t("create.dpi_axis_tip") as string) }}>
                        <el-input class="no-number-spinner" v-model={this.data.x_dpi} onBlur={this.fixNumber("x_dpi")} min={100} max={600} step={0.001} type="number" />
                    </el-form-item>
                    <el-form-item label={this.$t("create.y_dpi")} prop="y_dpi" scopedSlots={{ label: () => this.labelWithTip(this.$t("create.y_dpi") as string, this.$t("create.dpi_axis_tip") as string) }}>
                        <el-input class="no-number-spinner" v-model={this.data.y_dpi} onBlur={this.fixNumber("y_dpi")} min={100} max={600} step={0.001} type="number" />
                    </el-form-item>
                </Row>

                {/* 老板说先不做界面：开机时长(offset)输入框暂时注释掉，仅隐藏 UI，其余 JS 逻辑(类型/fixNumber 空值处理/请求透传)保持不变 */}
                {/* <el-form-item label={this.$t("create.offset")} prop="offset" scopedSlots={{ label: () => this.labelWithTip(this.$t("create.offset") as string, this.$t("create.offset_tip") as string) }}>
                    <el-input class="no-number-spinner" v-model={this.data.offset} onBlur={this.fixNumber("offset")} min={0} type="number" placeholder={this.$t("create.offset_placeholder") as string} />
                </el-form-item> */}

                <el-form-item label={this.$t("create.dns_urls")} prop="dns_urls">
                    <el-input v-model={this.data.dns_urls} />
                </el-form-item>

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
