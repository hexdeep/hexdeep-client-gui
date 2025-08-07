
import { deviceApi } from '@/api/device_api';
import { VNode } from 'vue';
import { Component, Prop } from "vue-property-decorator";
import * as tsx from 'vue-tsx-support';
import { CommonDialog, Dialog } from '../dialog/dialog';
import { ErrorProxy } from '../error_handle';
import { i18n } from '@/i18n/i18n';
import { DeviceInfo } from '@/api/device_define';

interface IData {
    label: string;
    options: {
        label: string;
        value: number;
    }[];
}

/**
 * 机型选择器
 */
@Component
export class ModelSelector extends tsx.Component<IPorps & IModelPorps, {}, {}> {
    @Prop() value!: number;
    protected modelList: IData[] = [];

    protected async created() {
        try {
            const e = await deviceApi.getModelList();
            this.modelList = Object.entries(e).map(([k, v]) => {
                return { label: k, options: Object.entries(v as object).map(([k1, v1]) => ({ label: k1, value: v1 })) };
            });
            this.modelList.splice(0, 0, { label: this.$t("default").toString(), options: [{ label: this.$t("random").toString(), value: 0 }] });
        } catch (error) {

        }
    }

    protected onInput(e) {
        this.$emit("input", e);
    }

    private get label() {
        let ret = this.$t("random").toString();
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
        const ret = await this.$dialog(ModelSelectotDialog).show(this.value);
        if (ret !== undefined) {
            this.$emit("input", ret);
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
export class ModelSelectotDialog extends CommonDialog<number, number> {
    protected modelList: IData[] = [];
    public override title: string = this.$t("modelSelector.title").toString();
    public override width: string = "650px";
    private loading: boolean = false;
    private value: number = 0;
    public immediateSubmit = false;
    public device: DeviceInfo | null = null;

    public override show(data?: number | undefined) {
        this.value = data || 0;
        return super.show(data);
    }

    protected async created() {
        try {
            this.loading = true;
            const e = await deviceApi.getModelList();
            this.modelList = Object.entries(e).map(([k, v]) => {
                return { label: k, options: Object.entries(v as object).map(([k1, v1]) => ({ label: k1, value: v1 })) };
            });
            this.modelList.splice(0, 0, { label: this.$t("default").toString(), options: [{ label: this.$t("random").toString(), value: 0 }] });
        } catch (error) {
            this.$message.error(`${error}`);
        } finally {
            this.loading = false;
        }
    }

    @ErrorProxy({ success: i18n.t("changeModel.success"), loading: i18n.t("loading") })
    protected override async onConfirm() {
        if (this.immediateSubmit) {
            if (!this.device) throw new Error("device is null");
            await deviceApi.changeModelMacvlan(this.device.android_sdk, this.value);
        }
        this.close(this.value);
    }

    protected override renderDialog(): VNode {
        return (
            <div style={{ padding: "15px" }}>
                <el-table v-loading={this.loading} default-expand-all data={this.modelList} width="100%" height="400px" style={{ minHeight: "400px" }}>
                    <el-table-column label={this.$t("modelSelector.brand")} prop="label" width="100px" />
                    <el-table-column label={this.$t("modelSelector.model")} prop="options" formatter={this.renderOptions} />
                </el-table>
            </div>
        );
    }

    private renderOptions(row: IData) {
        return row.options.map((v) => {
            return <el-radio v-model={this.value} label={v.value}>{v.label}</el-radio>;
        });
    }
}

interface IPorps {
}