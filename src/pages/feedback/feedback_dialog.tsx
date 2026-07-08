import { deviceApi } from "@/api/device_api";
import { HostInfo } from "@/api/device_define";
import { feedbackApi } from "@/api/feedback_api";
import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import s from './feedback_dialog.module.less';

@Dialog
export class FeedbackDialog extends CommonDialog<void, void> {
    public override width = "560px";

    private item = {
        description: "",
        sendLog: true,
    };
    private selectedMachines: string[] = [];
    private hosts: HostInfo[] = [];
    private hostsLoading = false;
    private fileList: any[] = [];

    public override async show() {
        this.title = this.$t("feedback.title").toString();
        this.loadHosts();
        return super.show();
    }

    private async loadHosts() {
        this.hostsLoading = true;
        try {
            this.hosts = await feedbackApi.getMachines();
            // 异步补齐备注，不阻塞列表显示
            this.hosts.forEach(h => {
                if (h.remark) return;
                deviceApi.getHostRemark(h.address).then(remark => {
                    this.$set(h, 'remark', remark);
                }).catch(() => { });
            });
        } catch (error) {
            console.warn(error);
        } finally {
            this.hostsLoading = false;
        }
    }

    private formatHostLabel(host: HostInfo): string {
        return host.remark ? `${host.address}(${host.remark})` : host.address;
    }

    private get formRules() {
        return {
            description: [
                { required: true, message: i18n.t("feedback.descriptionRequired"), trigger: 'blur' },
            ],
        };
    }

    @ErrorProxy({ success: i18n.t("feedback.success"), validatForm: "formRef", loading: i18n.t("loading") })
    protected override async onConfirm() {
        const machines = this.hosts.filter(h => this.selectedMachines.includes(h.address));
        await feedbackApi.submit({
            description: this.item.description,
            machines,
            sendLog: this.item.sendLog,
            files: this.fileList.map(f => f.raw),
        });
        this.close();
    }

    private handleChange(_file: any, fileList: any[]) {
        this.fileList = fileList;
    }

    private handleRemove(_file: any, fileList: any[]) {
        this.fileList = fileList;
    }

    protected renderDialog(): VNode {
        return (
            <el-form ref="formRef" props={{ model: this.item }} rules={this.formRules} label-position="top" class={s.body}>
                <el-form-item label={this.$t("feedback.description")} prop="description">
                    <el-input
                        type="textarea"
                        rows={4}
                        maxlength={1000}
                        show-word-limit
                        v-model={this.item.description}
                        placeholder={this.$t("feedback.descriptionPlaceholder")}
                    />
                </el-form-item>
                <el-form-item label={this.$t("feedback.relatedMachines")}>
                    <el-select
                        v-model={this.selectedMachines}
                        multiple
                        filterable
                        clearable
                        loading={this.hostsLoading}
                        style="width: 100%;"
                        placeholder={this.$t("feedback.relatedMachinesPlaceholder")}
                    >
                        {this.hosts.map(x => (
                            <el-option key={x.address} label={this.formatHostLabel(x)} value={x.address} />
                        ))}
                    </el-select>
                </el-form-item>
                <el-form-item label={this.$t("feedback.attachment")}>
                    <el-upload
                        drag
                        multiple
                        action="#"
                        attrs={{
                            "on-change": this.handleChange,
                            "on-remove": this.handleRemove,
                        }}
                        auto-upload={false}
                    >
                        <i class="el-icon-upload"></i>
                        <div class="el-upload__text">{this.$t("feedback.attachmentTip")}</div>
                    </el-upload>
                </el-form-item>
                <el-form-item>
                    <el-checkbox v-model={this.item.sendLog}>{this.$t("feedback.sendLog")}</el-checkbox>
                </el-form-item>
            </el-form>
        );
    }
}
