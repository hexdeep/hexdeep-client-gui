

import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import s from './import_vm.module.less';
import { HostInfo, ImportVmParam } from "@/api/device_define";
import { Watch } from "vue-property-decorator";
import { orderApi } from "@/api/order_api";
import { RentalRecord } from "@/api/order_define";

@Dialog
export class ImportVmDialog extends CommonDialog<HostInfo[], boolean> {
    private fileList: any[] = [];
    private selectedHost: string = "";
    private record: RentalRecord[] = [];
    private validInstance: number[] = [];
    private item: ImportVmParam = {
        host: { address: "", device_id: "", devices: [] },
        index: 0,
        name: "",
        local: ""
    };

    public override show(data: HostInfo[]) {
        this.data = data;
        this.title = this.$t("import.title").toString();
        if (this.data.isNotEmpty) {
            this.item.host = this.data.first;
            this.selectedHost = this.data.first.address;
        }
        return super.show(data);
    }

    private async selectedHostInput(v: string) {
        const e = this.data.find(x => x.address == v);
        if (e) {
            this.item.host = e;
            this.selectedHost = e.address;
        }
    }

    @Watch("item.host")
    protected async hostIpChange() {
        if (this.data && this.data.length > 0) {
            this.record = await orderApi.getRental(this.data.map(x => x.device_id).join(",")) || [];
            let arr = Array.from({ length: 12 }, (_, index) => index + 1);
            if (this.record.length > 0) {
                arr.removeWhere(x => this.record.first.device_indexes.contains(y => y.index == x && y.state == "expired"));
            }
            this.validInstance = arr || [];
            this.item.index = arr.length > 0 ? arr.first : 0;
        }
    }

    @ErrorProxy({ success: i18n.t("success"), loading: i18n.t("loading"), validatForm: "formRef" })
    protected override async onConfirm() {
        var path = await deviceApi.uploadToHost(this.item.host.address, this.fileList.first);
        await deviceApi.importDocker(this.item.host.address, this.item.index, this.item.name, path);
        this.close(true);
    }

    private handleChange(file, fileList) {
        console.log(file, fileList);
        this.fileList = [file];
        if (this.fileList.length > 0) this.item.local = this.fileList.first.name;
    }
    handleExceed(files, fileList) {
        console.log(files, fileList, files[0]);
        if (files.length > 0) {
            this.fileList = [files[0]];
            if (this.fileList.length > 0) this.item.local = this.fileList.first.name;
        }
    }

    private get formRules() {
        return {
            name: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
                { min: 1, max: 20, message: i18n.t("create.nameRule"), trigger: 'blur' },
                { pattern: /^[a-zA-Z0-9_]*$/, message: i18n.t("noMinus"), trigger: 'blur' },
            ],
            index: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
            ],
            host: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
            ],
            local: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
            ],
        };
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this.item }} rules={this.formRules} label-position="left" label-width="100px" class={s.body}>
                <el-form-item label={this.$t("import.hostIp")} prop="host">
                    <el-select value={this.selectedHost} onInput={this.selectedHostInput} placeholder={this.$t("import.hostIp")}>
                        {this.data.map(x => <el-option label={x.address} value={x.address} />)}
                    </el-select>
                </el-form-item>
                <el-form-item label={this.$t("import.index")} prop="index">
                    <el-select v-model={this.item.index} placeholder={this.$t("import.index")}>
                        {this.validInstance.map(x => <el-option label={`${i18n.t("instance.instance")}${x}`} value={x} />)}
                    </el-select>
                </el-form-item>
                <el-form-item label={this.$t("import.name")} prop="name">
                    <el-input v-model={this.item.name} maxlength={20} />
                </el-form-item>
                <el-form-item label={this.$t("import.file")} prop="local">
                    <el-upload multiple={false}
                        limit={1} action="#"
                        attrs={{
                            "on-change": this.handleChange,
                            "on-exceed": this.handleExceed,
                        }}
                        file-list={this.fileList} show-file-list={false} auto-upload={false}>
                        <el-input value={this.item.local} placeholder={this.$t("import.local")} readonly />
                    </el-upload>
                </el-form-item>
            </el-form >
        );
    }
}