
import { deviceApi } from '@/api/device_api';
import { ImageInfo } from "@/api/device_define";
import * as tsx from 'vue-tsx-support';
import { Component, Prop, Ref, Emit } from "vue-property-decorator";


@Component
export class ImageSelector2 extends tsx.Component<IPorps, IEvents, {}> {
    @Prop({ default: "" }) value!: string;
    @Prop({ default: () => [] }) images!: ImageInfo[];
    @Prop({ default: true }) showCustom!: boolean;
    @Prop({ default: false }) hasVip!: boolean; // 当前主机是否已开通VIP
    @Ref() elSelectRef!: any;

    private get list() {
        const custom = {
            name: this.$t("customImage"),
            address: "[customImage]",
            android_version: null,
            download: false,
            is_vip: false,
        };
        const list: any[] = [...this.images];
        if (this.showCustom) {
            list.unshift(custom);
        }
        return list;
    }

    protected created() {

    }

    protected mounted() {
        setTimeout(() => {
            this.elSelectRef.resetInputWidth();
        }, 500);
    }

    protected onInput(e: string) {
        // 检查是否选择了VIP镜像
        const selectedImage = this.list.find(img => img.address === e);
        if (selectedImage?.is_vip && !this.hasVip) {
            // 选择了VIP镜像但未开通VIP，触发事件
            this.$emit("vip-required");
            // 不更新值，阻止选择
            return;
        }
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
                    label={(e.android_version ? "[" + e.android_version + "] " : "") + e.name + (e.is_vip ? " [Beta]" : "")}
                    value={e.address}                    >
                    <div style={{ display: "flex", alignItems: "center" }}>
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
                        {e.is_vip && <el-tag 
                            size="mini" 
                            effect="dark"
                            style={{ 
                                marginLeft: "8px", 
                                background: "linear-gradient(135deg, #f5af19 0%, #f12711 100%)",
                                border: "none",
                                color: "#fff",
                                fontWeight: "bold"
                            }}
                        >{this.$t("vip.vipImage")}</el-tag>}
                    </div>;
                </el-option>)}
            </el-select>
        );
    }
}

interface IPorps {
    value?: string;
    images?: ImageInfo[];
    showCustom?: boolean;
    hasVip?: boolean;
}

interface IEvents {
    onInput: (value: string) => void;
    onVipRequired: () => void;
}
