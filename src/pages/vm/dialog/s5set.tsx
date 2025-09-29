

import { deviceApi, } from '@/api/device_api';
import { DeviceInfo, ProxyProtocolTypeOps, S5setParam } from "@/api/device_define";
import { i18n } from "@/i18n/i18n";
import { Row } from "@/lib/container";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { MyButton } from "@/lib/my_button";
import { VNode } from "vue";
import { CheckS5Dialog } from "./check_s5";
import { S5FormItems } from '@/lib/component/s5_form_items';


@Dialog
export class S5setDialog extends CommonDialog<DeviceInfo[], boolean> {
    //private isOpen = true;
    private item: S5setParam = {};

    public override show(data: DeviceInfo[]) {
        this.data = data;
        this.title = this.$t("s5set.title").toString();
        this.width = "750px";

        deviceApi.queryS5Macvlan(data.first.android_sdk).then(obj => {
            obj.isOpenProxy = obj.engine! > 0;
            //if (!obj.isOpenProxy) obj.protocol_type = 1;
            this.item = obj;
        });

        return super.show(data);
    }

    @ErrorProxy({ success: i18n.t("s5set.success"), loading: i18n.t("loading"), validatForm: "formRef" })
    protected override async onConfirm() {
        let tasks: Promise<void>[] = [];
        this.data.forEach(async e => {
            if (e.state) {
                if (this.item.isOpenProxy) {
                    tasks.push(deviceApi.s5setMacvlan(e.android_sdk, this.item));
                } else {
                    tasks.push(deviceApi.closeS5Macvlan(e.android_sdk));
                }
            }
        });
        if (tasks.length == 1) {
            await tasks[0];
        } else {
            await Promise.allSettled(tasks).catch(e => {
                console.warn(e);
            });
        }
        this.close(true);
    }

    private get formRules() {
        return {
            host: [
                { required: this.item.isOpenProxy && this.item.protocol_type == 1, message: i18n.t("notNull"), trigger: 'blur' },
                // { pattern: /^((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})(\.((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})){3}$/, message: i18n.t("invalidIp"), trigger: 'blur' },
            ],
            protocol_type: [
                { required: this.item.isOpenProxy, message: i18n.t("notNull"), trigger: 'blur' },
            ],
            address: [{
                required: this.item.isOpenProxy && this.item.protocol_type != 1, message: i18n.t("notNull"), trigger: 'blur'
            },],
            port: [
                { required: this.item.isOpenProxy && this.item.protocol_type == 1, message: i18n.t("notNull"), trigger: 'blur' },
                { pattern: /^([0-9]|[1-9]\d{1,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/, message: i18n.t("invalidPort"), trigger: 'blur' },
            ]
        };
    }

    @ErrorProxy({ validatForm: "formRef" })
    private checkS5() {
        let checkS5FormData = {
            hostIp: this.data.first.hostIp,
            s5Param: this.item,
            android_sdk: this.data.first.android_sdk,
        };
        this.$dialog(CheckS5Dialog).show(checkS5FormData);
    }


    protected override renderFooter() {
        return (
            <Row class={"dialog-footer"} padding={20} mainAlign="space-between">
                <MyButton text={i18n.t("checkS5.check")} onClick={() => this.checkS5()} plain disabled={!this.item.isOpenProxy} />
                <Row gap={10}>
                    <MyButton text={i18n.t("confirm.ok")} onClick={() => this.onConfirm()} type="primary" />
                    <MyButton text={i18n.t("confirm.cancel")} onClick={() => this.close()} />
                </Row>
            </Row>
        );
    }

    protected renderDialog(): VNode {
        return (
            <div style={{ "padding": "24px" }}>
                <el-form ref="formRef" props={{ model: this.item }} rules={this.formRules} label-position="left" label-width="150px">
                    <S5FormItems v-model={this.item}></S5FormItems>
                    {/* <el-form-item label={this.$t("create.enableS5Proxy")}  >
                        <el-switch v-model={this.isOpen} active-value={true} active-text={this.$t("create.enable")} inactive-value={false} inactive-text={this.$t("create.disable")} />
                    </el-form-item>
                    <el-form-item label={this.$t("create.s5_engine")} prop="engine" required>
                        <el-switch disabled={!this.isOpen} v-model={this.item.engine} active-value={2} active-text={this.$t("create.s5_engine2")} inactive-value={1} inactive-text={this.$t("create.s5_engine1")} />
                    </el-form-item>
                    <el-form-item label={this.$t("create.s5_protocol_type")} prop="protocol_type">
                        <el-select v-model={this.item.protocol_type} placeholder={this.$t("create.s5_protocol_type")} class="w-100">
                            {Object.entries(ProxyProtocolTypeOps[this.item.engine || 1]).map(([k, v]) => {
                                return <el-option label={v} value={parseInt(k)} />;
                            })}
                        </el-select>
                    </el-form-item>
                    {this.item.protocol_type != 1 && <el-form-item label={this.$t("create.s5_address")} prop="address">
                        <el-input disabled={!this.isOpen} v-model={this.item.address} type="textarea" rows={5} />
                    </el-form-item>}
                    {this.item.protocol_type == 1 && <el-form-item label={this.$t("create.s5_ip")} prop="host">
                        <el-input disabled={!this.isOpen} v-model={this.item.host} />
                    </el-form-item>}
                    {this.item.protocol_type == 1 && <el-form-item label={this.$t("create.s5_port")} prop="port">
                        <el-input disabled={!this.isOpen} v-model={this.item.port} type="number" min={1} max={65535} />
                    </el-form-item>}
                    {this.item.protocol_type == 1 && <el-form-item label={this.$t("create.s5_user")} prop="username">
                        <el-input disabled={!this.isOpen} v-model={this.item.username} />
                    </el-form-item>}
                    {this.item.protocol_type == 1 && <el-form-item label={this.$t("create.s5_pwd")} prop="password">
                        <el-input disabled={!this.isOpen} v-model={this.item.password} />
                    </el-form-item>}
                    <el-form-item label={this.$t("create.s5_dns_mode")} prop="dns_mode">
                        <el-switch disabled={!this.isOpen} v-model={this.item.dns_mode} active-value={2} active-text={this.$t("create.s5_dns_mode2")} inactive-value={1} inactive-text={this.$t("create.s5_dns_mode1")} />
                    </el-form-item>
                    {this.item.protocol_type == 1 && <el-form-item label={this.$t("create.s5_udp_over_tcp")} prop="udpOverTcp">
                        <el-switch disabled={!this.isOpen} v-model={this.item.udp_over_tcp} active-value={1} active-text={this.$t("create.s5_udp_over_tcp1")} inactive-value={0} inactive-text={this.$t("create.s5_udp_over_tcp0")} />
                    </el-form-item>} */}
                </el-form >
            </div>
        );
    }
}