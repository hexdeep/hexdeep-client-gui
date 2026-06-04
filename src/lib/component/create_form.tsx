import { CreateParam, ImageInfo } from "@/api/device_define";
import { Component, Prop, Watch } from "vue-property-decorator";
import * as tsx from 'vue-tsx-support';
import { Row } from '../container';
import "./create_form.less";
import { ImageSelector2 } from "./image_selector2";
import { ModelSelector } from "./model_selector";
import { CUSTOM_MODEL_VALUE, getOrLoadMobileModelList, MobileModelGroup, MobileModelOption, pickRandomMobileModelOption } from "./mobile_model_loader";
import { S5FormItems } from "./s5_form_items";
import { i18n } from "@/i18n/i18n";
import { isImageVersionCompatibleByModelVersion } from "@/common/common";
import Vue from 'vue';

@Component
export class CreateForm extends tsx.Component<IPorps, IEvents, ISlots> {
    @Prop({ default: () => { return []; } }) images!: ImageInfo[];
    @Prop({ default: () => { return []; } }) dockerRegistries!: string[];
    @Prop({ default: () => { return []; } }) validInstance!: number[];
    @Prop({ default: () => { return 0; } }) validIndex!: number;
    @Prop({ default: () => { sandbox_size: 64; } }) data!: CreateParam;
    @Prop({ default: true }) needName!: boolean;
    @Prop({ default: false }) isUpdate!: boolean;
    @Prop({ default: false }) hasVip!: boolean;
    @Prop({ default: false }) isBatchCreate!: boolean;
    @Prop({ default: "" }) ip!: string;

    // 将 index 包裹为响应式对象
    private index = Vue.observable({ value: this.validIndex });
    private filterState = Vue.observable({ imageType: 'base' });
    private modelList: MobileModelGroup[] = [];

    private get filteredImages() {
        const type = this.filterState.imageType;
        const byType = type === 'all'
            ? this.images
            : this.images.filter(img => img.name && img.name.includes(`-${type}-`));

        if (this.isUpdate) {
            return byType;
        }

        return byType.filter(img => isImageVersionCompatibleByModelVersion(this.data.mobile_model_version, img.address));
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

    @Watch("validIndex")
    onValidIndexChange(newVal: number) {
        this.index.value = newVal;
        if (!this.isBatchCreate && !this.isUpdate && newVal > 0) {
            this.$set(this.data, "subnet", this.getDefaultSubnet(newVal));
        }
    }

    protected async created() {
        this.index.value = this.validIndex;
        if (!this.isBatchCreate && !this.isUpdate && !this.data.subnet && this.validIndex > 0) {
            this.$set(this.data, "subnet", this.getDefaultSubnet(this.validIndex));
        }
        if (!this.data.mobile_model_version) {
            this.$set(this.data, "mobile_model_version", "v2");
        }
        await this.loadModelList();
        this.ensureValidModelSelection();
        this.ensureCompatibleSelectedImage();
    }

    private fixNumber(key: string) {
        return (e: Event) => {
            const target = e.target as HTMLInputElement;
            let val = Number(target.value);
            let min = Number(target.min);
            let max = Number(target.max);
            if (val < min) val = min;
            if (val > max) val = max;
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

    @Watch("data.mobile_model_version")
    async onModelVersionChange() {
        await this.loadModelList();
        this.ensureValidModelSelection();
        this.ensureCompatibleSelectedImage();
        this.syncModelDimensions();
    }

    @Watch("data.model_id")
    onModelIdChange() {
        this.syncModelDimensions();
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

        if (this.currentModelId > 0 && this.hasModelValue(this.currentModelId)) {
            return;
        }

        const option = pickRandomMobileModelOption(this.modelList);
        if (option) {
            this.$set(this.data, "model_id", option.value);
        }
    }

    private get selectedModelOption(): MobileModelOption | undefined {
        const value = this.currentModelId;
        for (const group of this.modelList) {
            const option = group.options.find(item => item.value === value);
            if (option) {
                return option;
            }
        }
        return;
    }

    private syncModelDimensions() {
        if (this.data.mobile_model_version !== "v3") return;
        if (this.isCustomModelSelected) return;
        const option = this.selectedModelOption;
        if (!option?.meta) return;

        this.$set(this.data, "width", option.meta.screen_width);
        this.$set(this.data, "height", option.meta.screen_height);
        this.$set(this.data, "dpi", option.meta.screen_density);
    }

    private ensureCompatibleSelectedImage() {
        if (!this.data.image_addr || this.data.image_addr === "[customImage]") {
            return;
        }
        if (!isImageVersionCompatibleByModelVersion(this.data.mobile_model_version, this.data.image_addr)) {
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
                    <Row>
                        <el-form-item label={this.$t("create.name")} prop="name">
                            <el-input v-model={this.data.name} maxlength={20} />
                        </el-form-item>
                        <el-form-item label={this.$t("clone.dstIndex")} prop="index">
                            <el-select
                                v-model={this.index.value}
                                onChange={(v: number) => {
                                    this.index.value = v;
                                    if (this.data) {
                                        this.$set(this.data, "index", v);
                                        if (!this.isBatchCreate && !this.isUpdate) {
                                            this.$set(this.data, "subnet", this.getDefaultSubnet(v));
                                        }
                                    }
                                }}
                            >
                                {this.validInstance.map(x => (
                                    <el-option
                                        label={`${i18n.t("instance.instance")}${x}`}
                                        value={x}
                                    />
                                ))}
                            </el-select>
                        </el-form-item>
                    </Row>
                )}

                {!this.isUpdate && (
                    <Row>
                        <el-form-item label={this.$t("create.sandbox")} prop="sandbox">
                            <el-switch v-model={this.data.sandbox} active-value={1} inactive-value={0} />
                        </el-form-item>

                        <el-form-item label={this.$t("create.sandbox_size")} prop="sandbox_size" required={this.data.sandbox == 1}>
                            <el-input v-model={this.data.sandbox_size} type="number" disabled={this.data.sandbox != 1} />
                        </el-form-item>
                    </Row>
                )}

                <el-form-item label={this.$t("create.subnet")} prop="subnet" >
                    <el-input v-model={this.data.subnet} disabled={this.data.mac_vlan == 1} />
                </el-form-item>

                <Row>
                    <el-form-item label={this.$t("create.mac_vlan")} prop="mac_vlan">
                        <el-switch v-model={this.data.mac_vlan} active-value={1} inactive-value={0} />
                    </el-form-item>

                    <el-form-item label={this.$t("create.ip")} prop="ip" >
                        <el-input v-model={this.data.ip} disabled={this.data.mac_vlan != 1} />
                    </el-form-item>
                </Row>

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
                        <el-input v-model={this.data.width} onBlur={this.fixNumber("width")} min={600} max={3000} type="number" />
                    </el-form-item>
                    <el-form-item label={this.$t("create.height")} prop="height">
                        <el-input v-model={this.data.height} onBlur={this.fixNumber("height")} min={600} max={3000} type="number" />
                    </el-form-item>
                </Row>

                <Row>
                    <el-form-item label={this.$t("create.dpi")} prop="dpi">
                        <el-input v-model={this.data.dpi} onBlur={this.fixNumber("dpi")} min={100} max={600} type="number" />
                    </el-form-item>
                    <el-form-item label={this.$t("create.fps")} prop="fps">
                        <el-input v-model={this.data.fps} onBlur={this.fixNumber("fps")} min={10} max={60} type="number" />
                    </el-form-item>
                </Row>

                {!this.isUpdate && (
                    <Row>
                        <el-form-item label={this.$t("create.mobile_model_version")} prop="mobile_model_version">
                            <el-radio-group v-model={this.data.mobile_model_version}>
                                <el-radio label="v2">v2</el-radio>
                                {/* v3 暂未完成，先隐藏 */}
                                {/* <el-radio label="v3">v3</el-radio> */}
                            </el-radio-group>
                        </el-form-item>
                        <el-form-item label={this.$t("create.model_id")} prop="model_id"  >
                            <ModelSelector
                                v-model={this.data.model_id}
                                version={this.data.mobile_model_version || "v2"}
                                ip={this.ip}
                                source={this.data.mobile_model_source}
                                on={{ "update:source": (v: string) => this.$set(this.data, "mobile_model_source", v) }}
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
    validInstance: number[];
    validIndex: number;
    isUpdate?: boolean;
    hasVip?: boolean;
    isBatchCreate?: boolean;
    ip?: string;
}

interface IEvents {
    onVipRequired: () => void;
}
