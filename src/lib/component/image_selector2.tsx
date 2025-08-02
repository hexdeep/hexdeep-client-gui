
import { deviceApi } from '@/api/device_api';
import { ImageInfo } from "@/api/device_define";
import * as tsx from 'vue-tsx-support';
import { Component, Prop, Ref } from "vue-property-decorator";


@Component
export class ImageSelector2 extends tsx.Component<IPorps, {}, {}> {
    @Prop({ default: "" }) value!: string;
    @Prop({ default: () => { } }) images!: ImageInfo[];
    @Ref() elSelectRef!: any;

    private get list() {
        return [
            {
                name: this.$t("customImage"),
                address: "[customImage]",
                android_version: null,
                download: false,
            }
            , ...this.images
        ];
    }

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
            <el-select ref="elSelectRef"
                value={this.value}
                style={{ width: "100%" }}
                onInput={this.onInput}>
                {this.list.map((e) => <el-option
                    key={e.address}
                    label={(e.android_version ? "[" + e.android_version + "] " : "") + e.name}
                    value={e.address}                    >
                    <div>
                        {e.android_version && <span
                            style={{
                                lineHeight: "20px",
                                padding: "0 3px",
                                marginRight: "5px",
                                backgroundColor: e.download ? "#f0f9eb" : "#fef0f0",
                                borderColor: e.download ? "#e1f3d8" : "#fde2e2",
                                color: e.download ? "#67c23a" : "#f56c6c",
                                borderRadius: "3px",
                            }}
                            title={e.download ? this.$t("create.downloaded").toString() : this.$t("create.unDownloaded").toString()}
                            type={e.download ? "success" : "danger"}>
                            {e.download && <i class="el-icon-check" />}
                            {!e.download && <i class="el-icon-close" />}
                        </span>}
                        {e.android_version && <span>[{e.android_version}] {e.name}</span>}
                        {!e.android_version && <span>{e.name}</span>}
                    </div>;
                </el-option>)}
            </el-select>
        );
    }
}

interface IPorps {
    value?: string;
    images?: ImageInfo[];
}