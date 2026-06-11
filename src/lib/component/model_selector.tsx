
import { deviceApi } from '@/api/device_api';
import { VNode } from 'vue';
import { Component, Prop, Watch } from "vue-property-decorator";
import * as tsx from 'vue-tsx-support';
import { CommonDialog, Dialog } from '../dialog/dialog';
import { MyButton } from '../my_button';
import { ErrorProxy } from '../error_handle';
import { i18n } from '@/i18n/i18n';
import { DeviceInfo, MobileModelDimensions, MobileModelFile } from '@/api/device_define';
import { CUSTOM_MODEL_VALUE, getOrLoadMobileModelList, MobileModelGroup, MobileModelOption, RANDOM_BRAND, RANDOM_MODEL_VALUE } from './mobile_model_loader';
import { MobileModelToolDownloadDialog } from './v2_tool_dialog';
import { makeVmApiUrl } from '@/common/common';

/**
 * 机型选择器
 */
@Component
export class ModelSelector extends tsx.Component<IPorps & IModelPorps, {}, {}> {
    @Prop() value!: number;
    @Prop({ default: "v2" }) version!: "v2" | "v3";
    @Prop({ default: "" }) ip!: string;
    @Prop({ default: "" }) source!: string;
    @Prop({ default: "" }) manufacturer!: string;
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
        const value = this.value;
        // 自定义机型：来源为空表示随机，否则显示文件名
        if (value === CUSTOM_MODEL_VALUE) {
            const name = this.source ? this.source.split(/[\\/]/).pop() : "";
            return name
                ? ` ${this.$t("modelSelector.customType")}: ${name}`
                : ` ${this.$t("modelSelector.customType")} (${this.$t("random")})`;
        }
        // 随机机型（value<=0）：可限定品牌
        if (!value || value <= 0) {
            const brand = (this.manufacturer || "").trim();
            return brand ? ` ${brand} ${this.$t("random")}` : ` ${this.$t("random")}`;
        }
        // 指定具体机型
        for (const item of this.modelList) {
            const model = item.options.find((v) => v.value == value);
            if (model) {
                return ` ${item.label} ${model.label}`;
            }
        }
        return "";
    }

    private async onClick() {
        const ret = await this.$dialog(ModelSelectotDialog).show({
            value: this.value,
            version: this.version,
            ip: this.ip,
            source: this.source,
            manufacturer: this.manufacturer,
        });
        if (ret !== undefined) {
            this.$emit("input", ret.model_id);
            this.$emit("update:source", ret.source);
            this.$emit("update:manufacturer", ret.manufacturer);
            this.$emit("model-selected", ret.option);
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
    // 预设随机时限定的品牌名（空表示全部品牌随机）
    private manufacturer: string = "";
    // 已上传的机型文件列表
    private uploadedModels: MobileModelFile[] = [];
    private uploadedLoading: boolean = false;
    private uploading: boolean = false;
    private deletingPath: string = "";

    public override show(data?: IModelDialogData | undefined) {
        this.value = data?.value || 0;
        this.version = data?.version || "v2";
        this.ip = data?.ip || "";
        this.source = data?.source || "";
        this.manufacturer = data?.manufacturer || "";
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
        } else {
            // value<=0 且非自定义：随机机型，按 manufacturer 还原已选品牌
            this.modelType = "preset";
            const brand = (this.manufacturer || "").trim();
            if (brand) {
                const group = this.presetGroups.find((g) => g.label.toLowerCase() === brand.toLowerCase());
                if (group) {
                    this.selectedBrand = group.label;
                    this.value = RANDOM_MODEL_VALUE;
                }
            }
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

            // 校验 source
            if (this.source) {
                const exists = this.uploadedModels.some((m) => m.path === this.source);
                if (!exists) {
                    // 被删除了，自动选择最新上传的机型
                    const latest = this.uploadedModels[this.uploadedModels.length - 1];
                    this.source = latest ? latest.path : "";
                }
            } else if (this.uploadedModels.length > 0) {
                // 初始为空，默认选最新机型
                this.source = this.uploadedModels[this.uploadedModels.length - 1].path;
            }
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

            const list = await deviceApi.uploadMobileModel(this.ip, this.version, option.file);

            this.uploadedModels = list || [];
            this.value = CUSTOM_MODEL_VALUE;

            const uploadedFileName = option.file.name;

            const current = this.uploadedModels.find((item) => item.name === uploadedFileName)
                || this.uploadedModels[this.uploadedModels.length - 1];

            if (current) {
                this.source = current.path;
            }

            this.$message.success(this.$t("modelSelector.uploadSuccess").toString());
            option.onSuccess?.(current);
        } catch (error) {
            this.$message.error(`${error}`);
            option.onError?.(error);
        } finally {
            this.uploading = false;
        }
    }

    private async deleteUploadedModel(model: MobileModelFile, event: Event) {
        event.stopPropagation();
        if (!this.ip || this.deletingPath) return;
        try {
            await this.$confirm(
                this.$t("modelSelector.deleteConfirm", [model.name]).toString(),
                i18n.t("confirm.title") as string,
                {
                    confirmButtonText: i18n.t("confirm.ok") as string,
                    cancelButtonText: i18n.t("confirm.cancel") as string,
                    type: "warning",
                }
            );
        } catch (error) {
            return;
        }
        try {
            this.deletingPath = model.path;
            await deviceApi.deleteMobileModel(this.ip, this.version, model.path);
            if (this.source === model.path) {
                this.source = "";
            }
            await this.loadUploadedModels();
            this.$message.success(this.$t("modelSelector.deleteSuccess").toString());
        } catch (error) {
            this.$message.error(`${error}`);
        } finally {
            this.deletingPath = "";
        }
    }

    private downloadUploadedModel(model: MobileModelFile, event: Event) {
        event.stopPropagation();
        event.preventDefault();
        if (!this.ip || !model.path) return;

        const link = makeVmApiUrl("host/download", this.ip) + `?path=${encodeURIComponent(model.path)}`;
        location.href = link;
    }

    private findModelOption(value: number): MobileModelOption | undefined {
        for (const group of this.presetGroups) {
            const option = group.options.find((o) => o.value === value);
            if (option) return option;
        }
        return;
    }

    private hasModelDimensions(model: MobileModelFile): model is MobileModelFile & MobileModelDimensions {
        return typeof model.screen_width === "number"
            && typeof model.screen_height === "number"
            && typeof model.screen_density === "number";
    }

    private findUploadedModel(path: string): MobileModelFile | undefined {
        return this.uploadedModels.find((model) => model.path === path);
    }

    private toUploadedModelOption(model?: MobileModelFile): MobileModelOption | undefined {
        if (!model || !this.hasModelDimensions(model)) {
            return;
        }
        return {
            label: model.name,
            value: CUSTOM_MODEL_VALUE,
            meta: {
                screen_width: model.screen_width,
                screen_height: model.screen_height,
                screen_density: model.screen_density,
                screen_xdpi: model.screen_xdpi,
                screen_ydpi: model.screen_ydpi,
            },
        };
    }

    // 将选择结果解析为提交字段。随机由后端完成，前端不再预先抽取具体机型。
    private resolveModelSelection(): { modelId: number; manufacturer: string; option?: MobileModelOption } {
        // 自定义机型：用 model_id 占位标记，具体来源走 source
        if (this.modelType === "custom") {
            return { modelId: CUSTOM_MODEL_VALUE, manufacturer: "" };
        }
        // 品牌随机：后端在所有品牌中随机
        if (this.selectedBrand === RANDOM_BRAND) {
            return { modelId: 0, manufacturer: "" };
        }
        // 指定品牌 + 机型随机：后端在该品牌内随机
        if (this.value === RANDOM_MODEL_VALUE) {
            return { modelId: 0, manufacturer: this.selectedBrand };
        }
        // 指定具体机型
        return { modelId: this.value, manufacturer: "", option: this.findModelOption(this.value) };
    }

    @ErrorProxy({ success: i18n.t("changeModel.success"), loading: i18n.t("loading") })
    protected override async onConfirm() {
        const selection = this.resolveModelSelection();
        const modelId = selection.modelId;
        const manufacturer = selection.manufacturer;
        let source = "";
        let selectedOption = selection.option;
        if (modelId === CUSTOM_MODEL_VALUE) {
            // 自定义机型：source 为空表示随机（提交时转为 "random"），有值则为具体路径并据此同步屏幕参数
            source = this.source;
            selectedOption = this.source ? this.toUploadedModelOption(this.findUploadedModel(this.source)) : undefined;
        }
        if (this.immediateSubmit) {
            if (!this.device) throw new Error("device is null");
            await deviceApi.changeModelMacvlan(this.device.android_sdk, modelId, source);
        }
        this.close({ model_id: modelId, manufacturer, source, option: selectedOption });
    }

    private openTool() {
        this.$dialog(MobileModelToolDownloadDialog).show({ version: this.version });
    }

    private getPresetModelDownloadUrl(option: MobileModelGroup["options"][number]): string {
        if (this.version === "v3") {
            return option.meta?.download_url || "";
        }
        return `https://download.hexdeep.com/mobile_cfgs/v2/${option.value}.tar`;
    }

    private async downloadPresetModel(option: MobileModelGroup["options"][number], event: Event) {
        event.stopPropagation();
        event.preventDefault();

        const url = this.getPresetModelDownloadUrl(option);
        if (!url) return;

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("下载失败");

            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = objectUrl;

            if (this.version === "v2") {
                // v2 自定义下载文件名
                const sanitizeFileName = (value: string) =>
                    value.trim().replace(/[\\/:*?"<>|\s]+/g, "_").replace(/^_+|_+$/g, "");
                const brand = sanitizeFileName(this.selectedBrand || "unknown");
                const model = sanitizeFileName(option.label || String(option.value));
                a.download = `${brand}_${model}.tar`;
            } else {
                // v3 使用服务器返回的原始文件名
                // 尝试从 URL 提取文件名
                const urlParts = url.split("/");
                a.download = urlParts[urlParts.length - 1] || "file.tar";
            }

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            URL.revokeObjectURL(objectUrl);
        } catch (error) {
            console.error(error);
            this.$message.error("下载失败");
        }
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
                            <el-option key={o.value} label={o.label} value={o.value}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                                    <el-button
                                        type="text"
                                        size="mini"
                                        icon="el-icon-download"
                                        nativeOnClick={(event: Event) => this.downloadPresetModel(o, event)}
                                    >
                                        {this.$t("modelSelector.download")}
                                    </el-button>
                                </div>
                            </el-option>
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
                        <el-option key={m.path} label={m.name} value={m.path}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                                <el-button
                                    type="text"
                                    size="mini"
                                    icon="el-icon-download"
                                    nativeOnClick={(event: Event) => this.downloadUploadedModel(m, event)}
                                >
                                    {this.$t("modelSelector.download")}
                                </el-button>
                                <el-button
                                    type="text"
                                    size="mini"
                                    icon={this.deletingPath === m.path ? "el-icon-loading" : "el-icon-delete"}
                                    disabled={!!this.deletingPath}
                                    nativeOnClick={(event: Event) => this.deleteUploadedModel(m, event)}
                                >
                                    {this.$t("delete")}
                                </el-button>
                            </div>
                        </el-option>
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
                <el-link type="primary" underline={false} onClick={() => this.openTool()}>
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
    manufacturer?: string;
}

interface IModelDialogData {
    value?: number;
    version?: "v2" | "v3";
    ip?: string;
    source?: string;
    manufacturer?: string;
}

interface IModelSelectResult {
    model_id: number;
    manufacturer: string;
    source: string;
    option?: MobileModelOption;
}
