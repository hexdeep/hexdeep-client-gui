
import { deviceApi } from '@/api/device_api';
import { VNode } from 'vue';
import { Component, Prop, Watch } from "vue-property-decorator";
import * as tsx from 'vue-tsx-support';
import { CommonDialog, Dialog } from '../dialog/dialog';
import { MyButton } from '../my_button';
import { ErrorProxy } from '../error_handle';
import { i18n } from '@/i18n/i18n';
import { DeviceInfo, MobileModelFile } from '@/api/device_define';
import { CUSTOM_MODEL_VALUE, getOrLoadMobileModelList, MobileModelGroup, RANDOM_BRAND, RANDOM_MODEL_VALUE } from './mobile_model_loader';
import { V2ToolDownloadDialog } from './v2_tool_dialog';

/**
 * 机型选择器
 */
@Component
export class ModelSelector extends tsx.Component<IPorps & IModelPorps, {}, {}> {
    @Prop() value!: number;
    @Prop({ default: "v2" }) version!: "v2" | "v3";
    @Prop({ default: "" }) ip!: string;
    @Prop({ default: "" }) source!: string;
    protected modelList: MobileModelGroup[] = [];

    protected async created() {
        await this.loadModelList();
    }

    @Watch("version")
    protected async onVersionChange() {
        await this.loadModelList();
    }

    private async loadModelList() {
        try {
            this.modelList = await getOrLoadMobileModelList(this.version, (key) => this.$t(key).toString());
        } catch (error) {

        }
    }

    protected onInput(e) {
        this.$emit("input", e);
    }

    private get label() {
        let ret = "";
        const value = this.value;
        if (!value) return ret;
        for (const item of this.modelList) {
            const model = item.options.find((v) => v.value == value);
            if (model) {
                ret = ` ${item.label} ${model.label}`;
                break;
            }
        }
        return ret;
    }

    private async onClick() {
        const ret = await this.$dialog(ModelSelectotDialog).show({
            value: this.value,
            version: this.version,
            ip: this.ip,
            source: this.source,
        });
        if (ret !== undefined) {
            this.$emit("input", ret.model_id);
            this.$emit("update:source", ret.source);
        }
    }

    protected render() {
        return (
            <el-input
                value={this.label}
                nativeOnClick={this.onClick}
            />
        );
    }
}

@Dialog
export class ModelSelectotDialog extends CommonDialog<IModelDialogData, IModelSelectResult> {
    protected modelList: MobileModelGroup[] = [];
    public override title: string = this.$t("modelSelector.title").toString();
    public override width: string = "650px";
    private loading: boolean = false;
    private value: number = 0;
    private version: "v2" | "v3" = "v2";
    // 机型类型：preset 预设机型，custom 自定义机型
    private modelType: "preset" | "custom" = "preset";
    // 预设机型下当前选中的品牌
    private selectedBrand: string = "";
    public immediateSubmit = false;
    public device: DeviceInfo | null = null;
    // 当前主机 IP，存在时才提供「上传/选择已上传机型」能力（创建/批量创建场景）
    private ip: string = "";
    // 自定义机型的服务器路径（选中已上传机型或手动上传后填充）
    private source: string = "";
    // 已上传的机型文件列表
    private uploadedModels: MobileModelFile[] = [];
    private uploadedLoading: boolean = false;
    private uploading: boolean = false;

    public override show(data?: IModelDialogData | undefined) {
        this.value = data?.value || 0;
        this.version = data?.version || "v2";
        this.ip = data?.ip || "";
        this.source = data?.source || "";
        return super.show(data);
    }

    protected override async onInit() {
        try {
            this.loading = true;
            this.modelList = await getOrLoadMobileModelList(this.version, (key) => this.$t(key).toString());
        } catch (error) {
            this.$message.error(`${error}`);
        } finally {
            this.loading = false;
        }
        await this.loadUploadedModels();
        this.syncSelectionFromValue();
    }

    // 预设机型分组（排除含「自定义」选项的「默认」分组）
    private get presetGroups(): MobileModelGroup[] {
        return this.modelList.filter((g) => !g.options.some((o) => o.value === CUSTOM_MODEL_VALUE));
    }

    // 当前品牌下的机型列表
    private get currentModelOptions() {
        const group = this.presetGroups.find((g) => g.label === this.selectedBrand);
        return group ? group.options : [];
    }

    // 根据初始 value/source 推断机型类型与已选品牌
    private syncSelectionFromValue() {
        if (this.value === CUSTOM_MODEL_VALUE || (!!this.source && this.value <= 0)) {
            this.modelType = this.ip ? "custom" : "preset";
        } else if (this.value > 0) {
            this.modelType = "preset";
            const group = this.presetGroups.find((g) => g.options.some((o) => o.value === this.value));
            if (group) this.selectedBrand = group.label;
        }
        // 预设机型未匹配到具体品牌时，默认选中「随机」品牌
        if (this.modelType === "preset" && !this.selectedBrand) {
            this.selectedBrand = RANDOM_BRAND;
        }
    }

    @Watch("modelType")
    protected onModelTypeChange(type: "preset" | "custom") {
        if (type === "custom") {
            this.value = CUSTOM_MODEL_VALUE;
        } else {
            this.source = "";
            if (!this.selectedBrand) {
                this.selectedBrand = RANDOM_BRAND;
            }
            // 恢复机型选择：具体品牌默认「随机」机型，品牌随机则为 0（机型选择项隐藏）
            if (this.value <= 0) {
                this.value = this.selectedBrand === RANDOM_BRAND ? 0 : RANDOM_MODEL_VALUE;
            }
        }
    }

    private onBrandChange(brand: string) {
        this.selectedBrand = brand;
        // 切换到具体品牌时，机型默认选中「随机」；品牌随机则无需指定机型
        this.value = brand === RANDOM_BRAND ? 0 : RANDOM_MODEL_VALUE;
    }

    private async loadUploadedModels() {
        if (!this.ip) return;
        try {
            this.uploadedLoading = true;
            this.uploadedModels = await deviceApi.getMobileModelUploadList(this.ip, this.version) || [];
        } catch (error) {
            this.uploadedModels = [];
        } finally {
            this.uploadedLoading = false;
        }
    }

    // 选中非自定义机型时清空自定义路径
    @Watch("value")
    protected onValueChange(v: number) {
        if (v > 0) {
            this.source = "";
        }
    }

    // el-upload 自定义上传：调用 super sdk 接口上传机型文件
    private async handleUpload(option: { file: File; onSuccess?: (res: any) => void; onError?: (err: any) => void; }) {
        if (!this.ip) {
            option.onError?.(new Error("ip is empty"));
            return;
        }
        try {
            this.uploading = true;
            const path = await deviceApi.uploadMobileModel(this.ip, this.version, option.file);
            // 上传成功即视为选中该自定义机型
            this.value = CUSTOM_MODEL_VALUE;
            this.source = path;
            await this.loadUploadedModels();
            this.$message.success(this.$t("modelSelector.uploadSuccess").toString());
            option.onSuccess?.(path);
        } catch (error) {
            this.$message.error(`${error}`);
            option.onError?.(error);
        } finally {
            this.uploading = false;
        }
    }

    // 将选择结果解析为最终提交的 model_id（解开「随机」占位值）
    private resolveModelId(): number {
        if (this.modelType === "custom") {
            return CUSTOM_MODEL_VALUE;
        }
        // 品牌随机：传 0，由后端随机选取机型
        if (this.selectedBrand === RANDOM_BRAND) {
            return 0;
        }
        // 当前品牌内机型随机：前端随机选取一个具体机型
        if (this.value === RANDOM_MODEL_VALUE) {
            const candidates = this.currentModelOptions.filter((o) => o.value > 0);
            if (candidates.length > 0) {
                return candidates[Math.floor(Math.random() * candidates.length)].value;
            }
            return 0;
        }
        return this.value;
    }

    @ErrorProxy({ success: i18n.t("changeModel.success"), loading: i18n.t("loading") })
    protected override async onConfirm() {
        const modelId = this.resolveModelId();
        // 选择了自定义但未指定具体机型时，从已上传机型中随机选一个
        if (modelId === CUSTOM_MODEL_VALUE && !this.source && this.uploadedModels.length > 0) {
            const random = this.uploadedModels[Math.floor(Math.random() * this.uploadedModels.length)];
            this.source = random.path;
        }
        if (this.immediateSubmit) {
            if (!this.device) throw new Error("device is null");
            await deviceApi.changeModelMacvlan(this.device.android_sdk, modelId);
        }
        this.close({ model_id: modelId, source: this.source });
    }

    private openV2Tool() {
        this.$dialog(V2ToolDownloadDialog).show();
    }

    // 自定义机型：既未选中具体机型，也没有可随机的已上传机型时，禁用确定按钮
    private get confirmDisabled(): boolean {
        return this.modelType === "custom" && !this.source && this.uploadedModels.length === 0;
    }

    protected override renderFooter() {
        return (
            <div class="dialog-footer">
                <MyButton text={i18n.t("confirm.ok")} disabled={this.confirmDisabled} onClick={() => this.onConfirm()} type="primary" />
                <MyButton text={i18n.t("confirm.cancel")} onClick={() => this.close()} />
            </div>
        );
    }

    protected override renderDialog(): VNode {
        return (
            <div style={{ padding: "15px" }} v-loading={this.loading}>
                <el-form label-width="90px">
                    <el-form-item label={this.$t("modelSelector.modelType")}>
                        <el-radio-group v-model={this.modelType}>
                            <el-radio label="preset">{this.$t("modelSelector.preset")}</el-radio>
                            <el-radio label="custom" disabled={!this.ip}>{this.$t("modelSelector.customType")}</el-radio>
                        </el-radio-group>
                    </el-form-item>
                    {this.modelType === "preset" ? this.renderPreset() : this.renderCustom()}
                </el-form>
            </div>
        );
    }

    // 预设机型：品牌 select + 具体型号 select（均含「随机」项，且为第一项）
    private renderPreset(): VNode[] {
        const items: VNode[] = [
            <el-form-item label={this.$t("modelSelector.brand")}>
                <el-select
                    value={this.selectedBrand}
                    placeholder={this.$t("modelSelector.brand")}
                    style={{ width: "100%" }}
                    onChange={(v: string) => this.onBrandChange(v)}
                >
                    <el-option key={RANDOM_BRAND} label={this.$t("random")} value={RANDOM_BRAND} />
                    {this.presetGroups.map((g) => (
                        <el-option key={g.label} label={g.label} value={g.label} />
                    ))}
                </el-select>
            </el-form-item>,
        ];
        // 品牌随机时无需指定机型
        if (this.selectedBrand !== RANDOM_BRAND) {
            items.push(
                <el-form-item label={this.$t("modelSelector.model")}>
                    <el-select v-model={this.value} placeholder={this.$t("modelSelector.notSelect")} style={{ width: "100%" }}>
                        <el-option key={RANDOM_MODEL_VALUE} label={this.$t("random")} value={RANDOM_MODEL_VALUE} />
                        {this.currentModelOptions.map((o) => (
                            <el-option key={o.value} label={o.label} value={o.value} />
                        ))}
                    </el-select>
                </el-form-item>,
            );
        }
        return items;
    }

    // 自定义机型：选择已上传机型 select + 上传 UI
    private renderCustom(): VNode[] {
        return [
            <el-form-item label={this.$t("modelSelector.uploadedLabel")}>
                <el-select
                    value={this.source}
                    placeholder={this.$t("modelSelector.selectUploaded")}
                    loading={this.uploadedLoading}
                    style={{ width: "100%" }}
                    onChange={(v: string) => {
                        this.source = v || "";
                        this.value = CUSTOM_MODEL_VALUE;
                    }}
                >
                    {this.uploadedModels.length > 0 && (
                        <el-option key="__random_source__" label={this.$t("random")} value="" />
                    )}
                    {this.uploadedModels.map((m) => (
                        <el-option key={m.path} label={m.name} value={m.path} />
                    ))}
                </el-select>
            </el-form-item>,
            <el-form-item label={this.$t("modelSelector.uploadLabel")}>
                <el-upload
                    action="#"
                    drag
                    show-file-list={false}
                    multiple={false}
                    disabled={this.uploading}
                    http-request={this.handleUpload}
                    style={{ width: "100%" }}
                >
                    <div v-loading={this.uploading} style={{ padding: "12px 0" }}>
                        <i class="el-icon-upload" style={{ fontSize: "30px", color: "#c0c4cc", lineHeight: "1" }} />
                        <div class="el-upload__text">{this.$t("modelSelector.uploadHint")}</div>
                    </div>
                </el-upload>
            </el-form-item>,
            // 提取工具下载入口（仅自定义机型）
            <el-form-item label={this.$t("modelSelector.tool")}>
                <el-link type="primary" underline={false} onClick={() => this.openV2Tool()}>
                    {this.$t("v2Tool.entry")}
                </el-link>
            </el-form-item>,
        ];
    }
}

interface IPorps {
    version?: "v2" | "v3";
    ip?: string;
    source?: string;
}

interface IModelDialogData {
    value?: number;
    version?: "v2" | "v3";
    ip?: string;
    source?: string;
}

interface IModelSelectResult {
    model_id: number;
    source: string;
}
