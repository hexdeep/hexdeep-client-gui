

import { CreateParam, ImageInfo } from "@/api/device_define";
import { Component, Prop } from "vue-property-decorator";
import * as tsx from 'vue-tsx-support';
import { Row } from '../container';
import "./create_form.less";
import { ImageSelector2 } from "./image_selector2";
import { ModelSelector } from "./model_selector";
import { S5FormItems } from "./s5_form_items";


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
                <el-form-item label={this.$t("create.subnet")} prop="subnet" >
                    <el-input v-model={this.data.subnet} placeholder="172.17.0.0/16" disabled={this.data.mac_vlan == 1} />
                </el-form-item>

                <el-form-item label={this.$t("create.memory")} prop="memory" >
                    <el-input v-model={this.data.memory} placeholder="请输入内存大小字节数" />
                </el-form-item>

                <Row>
                    <el-form-item label={this.$t("create.mac_vlan")} prop="mac_vlan">
                        <el-switch v-model={this.data.mac_vlan} active-value={1} inactive-value={0} />
                    </el-form-item>

                    <el-form-item label={this.$t("create.ip")} prop="ip" >
                        <el-input v-model={this.data.ip} disabled={this.data.mac_vlan != 1} />
                    </el-form-item>
                </Row>

                <el-form-item label={this.$t("create.image_addr")} prop="image_addr">
                    <ImageSelector2 images={this.images} v-model={this.data.image_addr} />
                </el-form-item>
                {this.data.image_addr == "[customImage]" && <el-form-item label={this.$t("customImage")} prop="custom_image">
                    <el-input v-model={this.data.custom_image} />
                </el-form-item>}
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
                    <el-form-item label={this.$t("create.model_id")} prop="model_id"  >
                        <ModelSelector v-model={this.data.model_id} />
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
    isUpdate?: boolean;
}