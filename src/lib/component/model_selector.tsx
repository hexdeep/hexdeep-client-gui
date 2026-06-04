
import { deviceApi } from '@/api/device_api';
import { VNode } from 'vue';
import { Component, Prop, Watch } from "vue-property-decorator";
import * as tsx from 'vue-tsx-support';
import { CommonDialog, Dialog } from '../dialog/dialog';
import { ErrorProxy } from '../error_handle';
import { i18n } from '@/i18n/i18n';
import { DeviceInfo, MobileModelFile } from '@/api/device_define';
import { CUSTOM_MODEL_VALUE, getOrLoadMobileModelList, MobileModelGroup } from './mobile_model_loader';
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

    @ErrorProxy({ success: i18n.t("changeModel.success"), loading: i18n.t("loading") })
    protected override async onConfirm() {
        // 选择了自定义但未指定具体机型时，从已上传机型中随机选一个
        if (this.value === CUSTOM_MODEL_VALUE && !this.source && this.uploadedModels.length > 0) {
            const random = this.uploadedModels[Math.floor(Math.random() * this.uploadedModels.length)];
            this.source = random.path;
        }
        if (this.immediateSubmit) {
            if (!this.device) throw new Error("device is null");
            await deviceApi.changeModelMacvlan(this.device.android_sdk, this.value);
        }
        this.close({ model_id: this.value, source: this.source });
    }

    private openV2Tool() {
        this.$dialog(V2ToolDownloadDialog).show();
    }

    protected override renderDialog(): VNode {
        return (
            <div style={{ padding: "15px" }}>
                <div style={{ marginBottom: "10px", textAlign: "right" }}>
                    <el-link type="primary" underline={false} onClick={() => this.openV2Tool()}>
                        {this.$t("v2Tool.entry")}
                    </el-link>
                </div>
                <el-table v-loading={this.loading} default-expand-all data={this.modelList} width="100%" height="400px" style={{ minHeight: "400px" }}>
                    <el-table-column label={this.$t("modelSelector.brand")} prop="label" width="100px" />
                    <el-table-column label={this.$t("modelSelector.model")} prop="options" formatter={this.renderOptions} />
                </el-table>
            </div>
        );
    }

    private renderOptions(row: MobileModelGroup) {
        const radios = row.options.map((v) => {
            return <el-radio v-model={this.value} label={v.value}>{v.label}</el-radio>;
        });
        // 「默认」分组（含自定义选项）且处于创建/批量创建场景时，追加「已上传机型」select 与上传区
        const isDefaultGroup = row.options.some((v) => v.value === CUSTOM_MODEL_VALUE);
        if (!isDefaultGroup || !this.ip) {
            return radios;
        }
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    {radios}
                    <el-select
                        value={this.source}
                        placeholder={this.$t("modelSelector.selectUploaded")}
                        size="small"
                        clearable
                        loading={this.uploadedLoading}
                        style={{ width: "260px" }}
                        onChange={(v: string) => {
                            this.source = v || "";
                            if (v) this.value = CUSTOM_MODEL_VALUE;
                        }}
                    >
                        {this.uploadedModels.map((m) => (
                            <el-option key={m.path} label={m.name} value={m.path} />
                        ))}
                    </el-select>
                </div>
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
            </div>
        );
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
