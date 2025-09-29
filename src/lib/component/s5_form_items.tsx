
import { CreateParam, ImageInfo, ProxyProtocolTypeOps, S5setParam } from "@/api/device_define";
import { Component, Prop, Watch } from "vue-property-decorator";
import * as tsx from 'vue-tsx-support';
import { Row } from '../container';
import "./create_form.less";

@Component
export class S5FormItems extends tsx.Component<IPorps, {}, ISlots> {
    @Prop({ default: () => { } }) value!: S5setParam;
    // private isOpen = true;
    // private item: S5setParam = {};

    @Watch("value.isOpenProxy")
    private onOpenChange() {
        if (this.value.isOpenProxy && !this.value.engine) {
            this.value.engine = (this.value.protocol_type || 1) > 1 ? 2 : 1;
        }
    }


    public render() {
        return (
            <div>
                <el-form-item label={this.$t("create.enableS5Proxy")}  >
                    <el-switch v-model={this.value.isOpenProxy} active-value={true} active-text={this.$t("create.enable")} inactive-value={false} inactive-text={this.$t("create.disable")} />
                </el-form-item>

                <el-form-item label={this.$t("create.s5_engine")} prop="engine" required={this.value.isOpenProxy}>
                    <el-switch disabled={!this.value.isOpenProxy} v-model={this.value.engine} active-value={2} active-text={this.$t("create.s5_engine2")} inactive-value={1} inactive-text={this.$t("create.s5_engine1")} />
                </el-form-item>

                <el-form-item label={this.$t("create.s5_protocol_type")} prop="protocol_type" >
                    <el-select v-model={this.value.protocol_type} placeholder={this.$t("create.s5_protocol_type")} class="w-100" disabled={!this.value.isOpenProxy}>
                        {Object.entries(ProxyProtocolTypeOps).map(([k, v]) => {
                            return <el-option label={v.label} value={parseInt(k)} disabled={v.engine && v.engine != this.value.engine} />;
                        })}
                    </el-select>
                </el-form-item>
                {this.value.protocol_type! > 1 && <el-form-item label={this.$t("create.s5_address")} prop="address">
                    <el-input disabled={!this.value.isOpenProxy} v-model={this.value.address} type="textarea" rows={4} />
                </el-form-item>}
                {this.value.protocol_type == 1 && <el-form-item label={this.$t("create.s5_ip")} prop="host">
                    <el-input disabled={!this.value.isOpenProxy} v-model={this.value.host} />
                </el-form-item>}
                {this.value.protocol_type == 1 && <el-form-item label={this.$t("create.s5_port")} prop="port">
                    <el-input disabled={!this.value.isOpenProxy} v-model={this.value.port} type="number" min={1} max={65535} />
                </el-form-item>}
                {this.value.protocol_type == 1 && <el-form-item label={this.$t("create.s5_user")} prop="username">
                    <el-input disabled={!this.value.isOpenProxy} v-model={this.value.username} />
                </el-form-item>}
                {this.value.protocol_type == 1 && <el-form-item label={this.$t("create.s5_pwd")} prop="password">
                    <el-input disabled={!this.value.isOpenProxy} v-model={this.value.password} />
                </el-form-item>}
                <el-form-item label={this.$t("create.s5_dns_mode")} prop="dns_mode">
                    <el-switch disabled={!this.value.isOpenProxy} v-model={this.value.dns_mode} active-value={2} active-text={this.$t("create.s5_dns_mode2")} inactive-value={1} inactive-text={this.$t("create.s5_dns_mode1")} />
                </el-form-item>
                {this.value.protocol_type == 1 && <el-form-item label={this.$t("create.s5_udp_over_tcp")} prop="udpOverTcp">
                    <el-switch disabled={!this.value.isOpenProxy} v-model={this.value.udp_over_tcp} active-value={1} active-text={this.$t("create.s5_udp_over_tcp1")} inactive-value={0} inactive-text={this.$t("create.s5_udp_over_tcp0")} />
                </el-form-item>}

            </div>
        );
    }

}

interface ISlots {
    default: void;
}
interface IPorps {
    value?: CreateParam | S5setParam;
    isOpen?: boolean;
    images?: ImageInfo[];
    isUpdate?: boolean;
}