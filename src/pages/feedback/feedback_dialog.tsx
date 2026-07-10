import { deviceApi } from "@/api/device_api";
import { HostInfo } from "@/api/device_define";
import { feedbackApi } from "@/api/feedback_api";
import { Config } from "@/common/Config";
import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { MyButton } from "@/lib/my_button";
import { VNode } from "vue";
import { FeedbackHistoryDialog } from "./feedback_history_dialog";
import { FeedbackSuccessDialog } from "./feedback_success_dialog";
import { feedbackStorage } from "./feedback_storage";
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
    private attachments: File[] = [];
    private previewUrls = new Map<File, string>();

    public override async show() {
        this.title = this.$t("feedback.title").toString();
        this.loadHosts();
        return super.show();
    }

    protected mounted() {
        document.addEventListener("paste", this.onPaste);
    }

    protected beforeDestroy() {
        document.removeEventListener("paste", this.onPaste);
        this.previewUrls.forEach(url => URL.revokeObjectURL(url));
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
            // 默认勾选当前前端直连的主机（即 super_sdk 所在机器），减少最常见场景下的手动选择
            const current = this.hosts.find(h => h.address === Config.host);
            if (current && this.selectedMachines.length === 0) {
                this.selectedMachines = [current.address];
            }
        } catch (error) {
            console.warn(error);
        } finally {
            this.hostsLoading = false;
        }
    }

    private openHistory() {
        this.$dialog(FeedbackHistoryDialog).show();
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

    @ErrorProxy({ validatForm: "formRef", loading: i18n.t("loading") })
    protected override async onConfirm() {
        const machines = this.hosts.filter(h => this.selectedMachines.includes(h.address));
        const uuid = await feedbackApi.submit({
            description: this.item.description,
            machines,
            sendLog: this.item.sendLog,
            files: this.attachments,
        });
        feedbackStorage.add(uuid);
        // 提交成功后展示可复制的 uuid，方便用户日后在“我的反馈”里凭 uuid 找回该条反馈
        await this.$dialog(FeedbackSuccessDialog).show(uuid);
        this.close();
    }

    private isImage(file: File): boolean {
        return file.type.startsWith("image/");
    }

    private addFiles(files: File[]) {
        files.forEach(file => {
            this.attachments.push(file);
            if (this.isImage(file)) {
                this.previewUrls.set(file, URL.createObjectURL(file));
            }
        });
    }

    private removeAttachment(index: number) {
        const [file] = this.attachments.splice(index, 1);
        const url = this.previewUrls.get(file);
        if (url) {
            URL.revokeObjectURL(url);
            this.previewUrls.delete(file);
        }
    }

    private openFilePicker() {
        (this.$refs.fileInput as HTMLInputElement).click();
    }

    private onFileInputChange(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files) {
            this.addFiles(Array.from(input.files));
        }
        input.value = "";
    }

    private onPaste(e: ClipboardEvent) {
        const items = e.clipboardData?.items;
        if (!items) return;
        const files: File[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === "file") {
                const file = item.getAsFile();
                if (file) files.push(file);
            }
        }
        if (files.length) this.addFiles(files);
    }

    protected override renderHeader(): any {
        return (
            <div class="dialog-header">
                <div class="dialog-title">{this.title}</div>
                <div class={s.headerActions}>
                    <MyButton
                        text={this.$t("feedback.historyButton").toString()}
                        size="mini"
                        color="#fff"
                        bgColor="rgba(255, 255, 255, 0.18)"
                        onClick={this.openHistory}
                    />
                    <div class="dialog-close el-icon-close" onClick={() => this.close()} />
                </div>
            </div>
        );
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
                    <div class={s.attachmentGrid}>
                        {this.attachments.map((file, index) => (
                            <div class={s.attachmentItem} key={index}>
                                {this.isImage(file)
                                    ? <img class={s.attachmentImage} src={this.previewUrls.get(file)} />
                                    : <div class={s.attachmentFile}>
                                        <i class="el-icon-document" />
                                        <span class={s.attachmentFileName}>{file.name}</span>
                                    </div>
                                }
                                <div class={s.attachmentRemove} onClick={() => this.removeAttachment(index)}>
                                    <i class="el-icon-close" />
                                </div>
                            </div>
                        ))}
                        <div class={s.attachmentAdd} onClick={this.openFilePicker}>
                            <i class="el-icon-plus" />
                        </div>
                    </div>
                    <div class={s.attachmentHint}>{this.$t("feedback.attachmentTip")}</div>
                    <input
                        ref="fileInput"
                        type="file"
                        multiple
                        class={s.attachmentInput}
                        onChange={this.onFileInputChange}
                    />
                </el-form-item>
                <el-form-item>
                    <el-checkbox v-model={this.item.sendLog}>{this.$t("feedback.sendLog")}</el-checkbox>
                </el-form-item>
            </el-form>
        );
    }
}
