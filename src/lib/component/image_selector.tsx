

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

    protected querySearch(queryString: string, cb: (res: any[]) => void) {
        queryString = queryString.replace(/\[\d*?\]/g, "").trim();
        var results = queryString ? this.images.filter((e) => e.name.includes(queryString)) : this.images;
        cb(results.map(e => ({ value: e.address, label: "[" + e.android_version + "] " + e.name })));
    }

    handleSelect(item) {
        this.$nextTick(() => {
            console.log(item, this.value);
            this.$emit("input", item.value);
        });
    }

    render() {
        return (
            <el-autocomplete value={this.currValue} value-key="label" fetch-suggestions={this.querySearch} onInput={this.onInput} placeholder="请输入内容" onSelect={this.handleSelect} >
            </el-autocomplete>
        );
    }
}

interface IPorps {
    value?: string;
    images?: ImageInfo[];
}