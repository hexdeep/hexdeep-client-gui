import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import s from './import_vm.module.less';
import { deviceApi } from '@/api/device_api';
import { DeviceInfo } from "@/api/device_define";
import { RentalRecord } from "@/api/order_define";
import { CloneVmParam } from "@/api/device_define";
import { orderApi } from "@/api/order_api";
import { getSuffixName } from "@/common/common";

@Dialog
export class CloneVmDialog extends CommonDialog<DeviceInfo, boolean> {

    private record: RentalRecord[] = [];
    private validInstance: number[] = [];

    private item: CloneVmParam = {
        index: 0,
        dst_name: "",
        remove: false,
    };

    public override show(data: DeviceInfo) {
        this.data = data;
        this.title = this.$t("clone.title").toString();
        this.item.dst_name = getSuffixName(data.name);
        this.hostIpChange();
        return super.show(data);
    }

    protected async hostIpChange() {
        this.record = await orderApi.getRental(this.data.hostId) || [];
        let arr = Array.from({ length: 12 }, (_, index) => index + 1);
        if (this.record.length > 0) {
            arr.removeWhere(x =>
                this.record.first.device_indexes.contains(y => y.index === x && y.state === "expired")
                || !this.record.first.device_indexes.contains(y => y.index === x)
            );
        } else {
            arr = [];
        }
        this.validInstance = arr || [];
        this.item.index = arr.length > 0 ? (arr.includes(this.data.index) ? this.data.index : arr.first) : 0;
    }

    @ErrorProxy({ success: i18n.t("success"), loading: i18n.t("loading"), validatForm: "formRef" })
    protected override async onConfirm() {
        await deviceApi.cloneVm(this.data.hostIp, this.data.name, this.item);
        this.close(true);
    }

    private get formRules() {
        return {
            dst_name: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
                { min: 1, max: 20, message: i18n.t("create.nameRule"), trigger: 'blur' },
                { pattern: /^[a-zA-Z0-9_]*$/, message: i18n.t("noMinus"), trigger: 'blur' },
            ],
            index: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
            ],
        };
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this.item }} rules={this.formRules} label-position="left" label-width="120px" class={s.body}>
                <el-form-item label={this.$t("clone.hostIp")}  >
                    {this.data.hostIp}
                </el-form-item>
                <el-form-item label={this.$t("clone.name")}  >
                    {getSuffixName(this.data.name)}
                </el-form-item>
                <el-form-item label={this.$t("clone.dstIndex")} prop="index">
                    <el-select v-model={this.item.index} placeholder={this.$t("clone.index")}>
                        {this.validInstance.map(x => <el-option label={`${i18n.t("instance.instance")}${x}`} value={x} />)}
                    </el-select>
                </el-form-item>
                <el-form-item label={this.$t("clone.dstName")} prop="dst_name">
                    <el-input v-model={this.item.dst_name} maxlength={20} />
                </el-form-item>

            </el-form >
        );
    }
}