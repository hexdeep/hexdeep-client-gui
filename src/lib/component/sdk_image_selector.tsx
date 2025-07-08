
import { deviceApi } from '@/api/device_api';
import { ImageInfo, SDKImageInfo } from "@/api/device_define";
import * as tsx from 'vue-tsx-support';
import { Component, Prop, Ref } from "vue-property-decorator";


@Component
export class SDKImageSelector extends tsx.Component<IPorps, {}, {}> {
    @Prop({ default: "" }) value!: string;
    @Prop({ default: "" }) hostIp!: string;
    @Ref() elSelectRef!: any;

    protected images: SDKImageInfo[] = [];

    //protected images: ImageInfo[] = [];

    protected created() {
        deviceApi.getSDKImages(this.hostIp).then((re) => {
            this.images = re.images;
            var find = this.images.find(x => x.version == re.current_version);
            if (find) {
                this.onInput(find.address);
            }
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

    render() {
        return (
            <el-select ref="elSelectRef" filterable allow-create value={this.value} style={{ width: "100%" }} onInput={this.onInput}>
                {this.images.map((e) => <el-option key={e.address} label={"[" + e.version + "] " + e.address} value={e.address} />)}
            </el-select>
        );
    }
}

interface IPorps {
    value?: string;
    hostIp: string;
}