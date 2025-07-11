import { deviceApi } from '@/api/device_api';
import { HostInfo, ImportVmParam } from "@/api/device_define";
import { orderApi } from "@/api/order_api";
import { RentalRecord } from "@/api/order_define";
import { Tool } from "@/common/Tools";
import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ElForm } from "element-ui/types/form";
import { VNode } from "vue";
import { Watch } from "vue-property-decorator";
import s from './import_vm.module.less';
import { MyButton } from '@/lib/my_button';

@Dialog
export class ImportVmDialog extends CommonDialog<HostInfo[], boolean> {
    private fileList: any[] = [];
    private selectedHost: string = "";
    private record: RentalRecord[] = [];
    private validInstance: number[] = [];
    private uploadTask: { promise: Promise<any>, cancel: () => void; } | null = null;
    private get readonly() { return this.uploadTask != null; }
    private progress: { bytesPerSecond: number, progress: number, startTime: number; } | null = null;

    private item: ImportVmParam = {
        host: { address: "", device_id: "", devices: [] },
        index: 0,
        name: "",
        local: ""
    };

    public override close(result?: boolean | undefined): Promise<boolean> {
        if (this.uploadTask) {
            this.uploadTask.cancel();
        }
        return super.close(result);
    }

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

    protected override renderFooter() {
        return (
            <div class="dialog-footer">
                <MyButton text={i18n.t("confirm.ok")} disabled={this.readonly} onClick={() => this.onConfirm()} type="primary" />
                <MyButton text={i18n.t("confirm.cancel")} onClick={() => this.close()} />
            </div>
        );
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

    protected override async onConfirm() {
        const form = this.$refs.formRef as ElForm;
        const valid = await form.validate().catch(() => false);
        if (!valid) return;
        try {
            this.progress = {
                bytesPerSecond: 0,
                progress: 0,
                startTime: Date.now(),
            };
            this.uploadTask = deviceApi.uploadToHost(this.item.host.address, this.fileList.first, (progressEvent) => {
                if (progressEvent.loaded == progressEvent.total) return;
                if (this.progress) {
                    this.progress.bytesPerSecond = progressEvent.loaded / ((Date.now() - this.progress.startTime) / 1000);
                    this.progress.progress = Math.round(progressEvent.loaded / progressEvent.total * 100);
                }

            });
            const ret = await this.uploadTask.promise;
            await deviceApi.importDocker(this.item.host.address, this.item.index, this.item.name, ret);
            this.$message.success(this.$t("success").toString());
            this.close(true);
        } catch (error) {
            console.error(error);
            if (error != "aborted") {
                this.$alert(`${error}`, this.$t("error").toString(), { type: "error" });
            }
        } finally {
            this.uploadTask = null;
        }
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
                    <el-select disabled={this.readonly} value={this.selectedHost} onInput={this.selectedHostInput} placeholder={this.$t("import.hostIp")}>
                        {this.data.map(x => <el-option label={x.address} value={x.address} />)}
                    </el-select>
                </el-form-item>
                <el-form-item label={this.$t("import.index")} prop="index">
                    <el-select disabled={this.readonly} v-model={this.item.index} placeholder={this.$t("import.index")}>
                        {this.validInstance.map(x => <el-option label={`${i18n.t("instance.instance")}${x}`} value={x} />)}
                    </el-select>
                </el-form-item>
                <el-form-item label={this.$t("import.name")} prop="name">
                    <el-input disabled={this.readonly} v-model={this.item.name} maxlength={20} />
                </el-form-item>
                <el-form-item label={this.$t("import.file")} prop="local">
                    <el-upload multiple={false}
                        limit={1} action="#"
                        attrs={{
                            "on-change": this.handleChange,
                            "on-exceed": this.handleExceed,
                        }}
                        file-list={this.fileList} show-file-list={false} auto-upload={false}>
                        <el-input class={s.uploadInput} disabled={this.readonly} value={this.item.local} placeholder={this.$t("import.local")} readonly />
                        {this.progress && <el-progress percentage={this.progress.progress} />}
                        {this.progress && <div>{this.$t("import.speed")}: {this.formatSpeed()}</div>}
                    </el-upload>
                </el-form-item>
            </el-form >
        );
    }

    private formatSpeed(): string {
        if (!this.progress) return "";
        return `${Tool.getFileSize(this.progress.bytesPerSecond)}/s`;
    }
}