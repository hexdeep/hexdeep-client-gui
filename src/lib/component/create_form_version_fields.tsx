import { CreateParam, ImageInfo, MobileModelDimensions } from "@/api/device_define";
import { isImageVersionCompatibleByModelVersion } from "@/common/common";
import { Component, Prop } from "vue-property-decorator";
import * as tsx from 'vue-tsx-support';
import { VNode } from 'vue';
import { Row } from '../container';
import { ImageSelector2 } from "./image_selector2";
import { ModelSelector } from "./model_selector";
import { CUSTOM_MODEL_VALUE } from "./mobile_model_loader";

/**
 * 创建云机表单中「机型版本/型号」「镜像类型」「镜像地址」这三行，按安卓版本参数化，
 * 供 CreateForm 在每个安卓版本 tab page 里各实例化一份（各自过滤对应版本的镜像列表）。
 * 其余表单项（自定义机型路径/镜像加速/分辨率/DPI/DNS 等）不随安卓版本变化，留在 CreateForm 里。
 */
@Component
export class CreateFormVersionFields extends tsx.Component<IProps, IEvents, {}> {
    @Prop({ required: true }) data!: CreateParam;
    @Prop({ required: true }) filterState!: { imageType: string; };
    @Prop({ default: () => [] }) images!: ImageInfo[];
    @Prop({ required: true }) androidVersion!: number;
    @Prop({ default: false }) hasVip!: boolean;
    @Prop({ default: "" }) ip!: string;
    @Prop({ default: false }) isUpdate!: boolean;

    private get filteredImages() {
        const type = this.filterState.imageType;
        const byType = type === 'all'
            ? this.images
            : this.images.filter(img => img.name && img.name.includes(`-${type}-`));

        const byAndroidVersion = byType.filter(img => img.android_version === this.androidVersion);

        return byAndroidVersion.filter(img => isImageVersionCompatibleByModelVersion(this.data.mobile_model_version, img.major_version));
    }

    private roundDpi(value: number) {
        return Math.round(value * 1000) / 1000;
    }

    private get isCustomModelSelected() {
        return Number(this.data.model_id ?? 0) === CUSTOM_MODEL_VALUE;
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

    // 用户在机型对话框点击「覆盖到表单」后，才用机型屏幕参数覆盖当前表单
    private onApplyDimensions(meta?: MobileModelDimensions) {
        if (meta) {
            this.applyModelDimensions(meta);
        }
    }

    protected render(): VNode {
        return (
            <div>
                <Row>
                    <el-form-item label={this.$t("create.mobile_model_version")} prop="mobile_model_version">
                        <el-radio-group v-model={this.data.mobile_model_version}>
                            {/* 安卓14镜像依赖v3机型，此 tab 下不展示v2，见 CreateForm 的 onAndroidVersionFilterChange */}
                            {this.androidVersion !== 14 && <el-radio label="v2">v2</el-radio>}
                            <el-radio label="v3">v3</el-radio>
                        </el-radio-group>
                    </el-form-item>
                    {/* 型号(model_id)在更新云机时不生效：真正的机型信息在创建时一次性写入 /data，
                        UpdateContainer 只重建容器、复用原有 /data，不会重新生成机型数据，所以更新表单
                        不展示这一项，避免让用户误以为改了这里就能改到已运行云机的机型。 */}
                    {!this.isUpdate && (
                        <el-form-item label={this.$t("create.model_id")} prop="model_id">
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
                    )}
                </Row>

                {!this.isUpdate && this.isCustomModelSelected && (
                    <el-form-item label={this.$t("create.custom_model_path")} prop="mobile_model_source" label-width="120px">
                        <el-input
                            v-model={this.data.mobile_model_source}
                            placeholder={this.$t("create.custom_model_path_placeholder")}
                        />
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
            </div>
        );
    }
}

interface IProps {
    data: CreateParam;
    filterState: { imageType: string; };
    images?: ImageInfo[];
    androidVersion: number;
    hasVip?: boolean;
    ip?: string;
    isUpdate?: boolean;
}

interface IEvents {
    onVipRequired: () => void;
}
