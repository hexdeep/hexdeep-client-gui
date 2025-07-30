

import { CreateParam, ImageInfo } from "@/api/device_define";
import * as tsx from 'vue-tsx-support';
import { Component, Prop } from "vue-property-decorator";
import { ModelEditor } from './model_editor';
import { Row } from '../container';
import "./create_form.less";
import { ImageSelector } from "./image_selector";
import { ModelSelector } from "./model_selector";


@Component
export class CreateForm extends tsx.Component<IPorps, {}, ISlots> {
    @Prop({ default: () => { return []; } }) images!: ImageInfo[];
    @Prop({ default: () => { sandbox_size: 16; } }) data!: CreateParam;
    @Prop({ default: true }) needName!: boolean;
    @Prop({ default: false }) isUpdate!: boolean;

    protected async created() {
    }

    private inputNumber(key: string, min: number, max: number) {
        return (v: string) => {
            let val = Number(v);
            if (val < min) val = min;
            if (val > max) val = max;
            this.$set(this.data, key, val);
        };
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

    public render() {
        return (
            <div>
                {this.$scopedSlots.default ? this.$scopedSlots.default() : ""}
                {this.needName && (
                    <el-form-item label={this.$t("create.name")} prop="name">
                        <el-input v-model={this.data.name} maxlength={20} />
                    </el-form-item>
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
                )
                }

                <Row>
                    <el-form-item label={this.$t("create.mac_vlan")} prop="mac_vlan">
                        <el-switch v-model={this.data.mac_vlan} active-value={1} inactive-value={0} />
                    </el-form-item>

                    <el-form-item label={this.$t("create.ip")} prop="ip" >
                        <el-input v-model={this.data.ip} disabled={this.data.mac_vlan != 1} />
                    </el-form-item>
                </Row>

                <el-form-item label={this.$t("create.image_addr")} prop="image_addr">
                    <ImageSelector images={this.images} v-model={this.data.image_addr} />
                </el-form-item>
                <Row>
                    <el-form-item label={this.$t("create.width")} prop="width">
                        <el-input v-model={this.data.width} onBlur={this.fixNumber("width")} min={600} max={2400} type="number" />
                    </el-form-item>
                    <el-form-item label={this.$t("create.height")} prop="height">
                        <el-input v-model={this.data.height} onBlur={this.fixNumber("height")} min={600} max={2400} type="number" />
                    </el-form-item>
                </Row>
                <Row>
                    <el-form-item label={this.$t("create.dpi")} prop="dpi">
                        <el-input v-model={this.data.dpi} onBlur={this.fixNumber("dpi")} min={100} max={400} type="number" />
                    </el-form-item>
                    <el-form-item label={this.$t("create.fps")} prop="fps">
                        <el-input v-model={this.data.fps} onBlur={this.fixNumber("fps")} min={10} max={60} type="number" />
                    </el-form-item>
                </Row>
                {!this.isUpdate && (
                    <el-form-item label={this.$t("create.model_id")} prop="model_id"  >
                        <ModelSelector v-model={this.data.model_id} />
                    </el-form-item>
                )}

                <el-form-item label={this.$t("create.dns_urls")} prop="dns_urls">
                    <el-input v-model={this.data.dns_urls} />
                </el-form-item>
                {!this.isUpdate && (
                    <el-form-item label={this.$t("create.s5_domain_mode")} prop="s5_domain_mode">
                        <el-switch v-model={this.data.s5_domain_mode} active-value={2} active-text={this.$t("create.s5_domain_mode2")} inactive-value={1} inactive-text={this.$t("create.s5_domain_mode1")} />
                    </el-form-item>
                )}
                {!this.isUpdate && (
                    <Row>
                        <el-form-item label={this.$t("create.s5_ip")} prop="s5_ip">
                            <el-input v-model={this.data.s5_ip} />
                        </el-form-item>
                        <el-form-item label={this.$t("create.s5_port")} prop="s5_port">
                            <el-input v-model={this.data.s5_port} type="number" min={1} max={65535} />
                        </el-form-item>
                    </Row>
                )}
                {!this.isUpdate && (
                    <Row>
                        <el-form-item label={this.$t("create.s5_user")} prop="s5_user">
                            <el-input v-model={this.data.s5_user} />
                        </el-form-item>
                        <el-form-item label={this.$t("create.s5_pwd")} prop="s5_pwd">
                            <el-input v-model={this.data.s5_pwd} />
                        </el-form-item>
                    </Row>
                )}
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
    isUpdate?: boolean;
}