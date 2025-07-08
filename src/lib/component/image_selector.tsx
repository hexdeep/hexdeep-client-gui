

import { ImageInfo } from "@/api/device_define";
import * as tsx from 'vue-tsx-support';
import { Component, Prop, Ref } from "vue-property-decorator";


@Component
export class ImageSelector extends tsx.Component<IPorps, {}, {}> {
    @Prop({ default: "" }) value!: string;
    @Prop({ default: () => { } }) images!: ImageInfo[];
    @Ref() elSelectRef!: any;

    protected get currValue() {
        var t = this.images.find(x => x.address == this.value);
        if (t) {
            return `[${t.android_version}] ${t.name}`;
        }
        return this.value;
    }

    protected created() {

    }

    protected onInput(e) {
        this.$emit("input", e);
    }

    protected querySearch(queryString: string, cb: (res: any) => void) {
        queryString = queryString.replace(/\[\d*?\]/g, "").trim();
        var results = queryString ? this.images.filter((e) => e.name.includes(queryString)) : this.images;

        cb(results.map(e => ({ obj: e, value: e.address })));

    }

    handleSelect(item) {
        this.$nextTick(() => {
            console.log(item, this.value);
            this.$emit("input", item.value);
        });
    }

    render() {
        return (
            <el-autocomplete value={this.currValue}
                scopedSlots={{
                    default: ({ item } ) => {
                        return <div>
                            <el-tag title={item.obj.download ? this.$t("create.downloaded") : this.$t("create.unDownloaded")} type={item.obj.download ? "success" : "danger"}><i class="el-icon-circle-check"></i>
                            </el-tag>
                            [{item.obj.android_version}] {item.obj.name}
                        </div>
                    }
                }}
                value-key="label"
                fetch-suggestions={this.querySearch}
                onInput={this.onInput}
                // placeholder={this.$t("create.placeholder")} 
                onSelect={this.handleSelect} >
            </el-autocomplete>
        );
    }
}

interface IPorps {
    value?: string;
    images?: ImageInfo[];
}