
import { deviceApi } from '@/api/device_api';
import { ImageInfo } from "@/api/device_define";
import * as tsx from 'vue-tsx-support';
import { Component, Prop, Ref } from "vue-property-decorator";


@Component
export class ImageSelector2 extends tsx.Component<IPorps, {}, {}> {
    @Prop({ default: "" }) value!: string;
    @Prop({ default: () => { } }) images!: ImageInfo[];
    @Ref() elSelectRef!: any;

    //protected images: ImageInfo[] = [];

    protected created() {

    }

    protected mounted() {
        setTimeout(() => {
            this.elSelectRef.resetInputWidth();
        }, 500);
    }

    protected onInput(e) {
        this.$emit("input", e);
    }

    render() {
        return (
            <el-select ref="elSelectRef" filterable allow-create value={this.value} style={{ width: "100%" }} onInput={this.onInput}>
                {this.images.map((e) => <el-option key={e.address} label={"[" + e.android_version + "] " + e.name} value={e.address} />)}
            </el-select>
        );
    }
}

interface IPorps {
    value?: string;
    images?: ImageInfo[];
}