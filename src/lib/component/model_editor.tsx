
import { deviceApi } from '@/api/device_api';
import { i18n } from '@/i18n/i18n';
import { Component, Prop, Ref } from "vue-property-decorator";
import * as tsx from 'vue-tsx-support';

@Component
export class ModelEditor extends tsx.Component<IPorps, {}, {}> {
    @Prop({ default: 0 }) value!: number;
    @Ref() elSelectRef!: any;
    protected modelList: any[] = [];
    private static cachedModelList: any[] | null = null;
    private loading = true;
    private err = "";

    protected created() {
        if (ModelEditor.cachedModelList != null) {
            console.log("From cache load model list");
            this.modelList = ModelEditor.cachedModelList;
            this.loading = false;
            return;
        }
        deviceApi.getModelList().then(e => {
            this.modelList = Object.entries(e).map(([k, v]) => {
                return { label: k, options: Object.entries(v as object).map(([k1, v1]) => ({ label: k1, value: v1 })) };
            });
            this.modelList.splice(0, 0, { label: i18n.t("default"), options: [{ label: i18n.t("random"), value: 0 }] });
            ModelEditor.cachedModelList = this.modelList;
            console.log("Cache model list", this.modelList);
        }).catch(e => {
            this.err = `${e}`;
        }).finally(() => {
            this.loading = false;
            this.$forceUpdate();
        });
    }

    protected mounted() {
        setTimeout(() => {
            this.elSelectRef.resetInputWidth();
        }, 500);
    }

    protected onInput(e) {
        this.$emit("input", e);
    }

    protected render() {
        return (
            <el-select ref="elSelectRef" value={this.value} style={{ width: "100%" }} onInput={this.onInput}>
                {!this.loading && this.modelList.map(g => {
                    return <el-option-group key={g.label} label={g.label}>
                        {g.options.map(o => <el-option key={o.label} label={o.label} value={o.value} />)}
                    </el-option-group>;
                })}
                {this.loading && <el-option label={i18n.t("loading")} value={0} disabled />}
                {this.err && <el-option label={this.err} value={0} disabled />}
            </el-select>
        );
    }

}

interface IPorps {
    value?: number;
}