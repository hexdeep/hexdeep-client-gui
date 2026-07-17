import { feedbackApi } from "@/api/feedback_api";
import { FeedbackMessage, FeedbackPublicItem } from "@/api/feedback_define";
import { Tools } from "@/common/common";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { MyButton } from "@/lib/my_button";
import { VNode } from "vue";
import { feedbackStorage, FeedbackHistoryEntry } from "./feedback_storage";
import s from './feedback_history_dialog.module.less';

@Dialog
export class FeedbackHistoryDialog extends CommonDialog<void, void> {
    public override width = "560px";

    private historyEntries: FeedbackHistoryEntry[] = [];
    private items: FeedbackPublicItem[] = [];
    private loading = false;
    private selected: FeedbackPublicItem | null = null;
    private searchUuid = "";
    private searching = false;

    private composeMessage = "";
    private composeFiles: File[] = [];
    private composePreviewUrls = new Map<File, string>();
    private sending = false;

    public override async show() {
        this.title = this.$t("feedback.historyTitle").toString();
        // 先用本地缓存的 uuid 列表把条目数/顺序显示出来，标题文本等查询结果回来再补上
        this.historyEntries = feedbackStorage.getAll();
        this.loadItems();
        return super.show();
    }

    protected mounted() {
        document.addEventListener("paste", this.onPaste);
    }

    protected beforeDestroy() {
        document.removeEventListener("paste", this.onPaste);
        this.composePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    }

    private async loadItems() {
        if (this.historyEntries.length === 0) return;
        this.loading = true;
        try {
            const result = await feedbackApi.queryByUuid(this.historyEntries.map(e => e.uuid));
            const order = new Map(this.historyEntries.map((e, i) => [e.uuid, i]));
            this.items = result.slice().sort((a, b) => (order.get(a.uuid) ?? 0) - (order.get(b.uuid) ?? 0));
        } catch (error) {
            console.warn(error);
        } finally {
            this.loading = false;
        }
    }

    // 支持凭 uuid 直接查找反馈（例如用户在别的设备提交、只保留了提交成功弹窗里的 uuid）
    private async searchByUuid() {
        const uuid = this.searchUuid.trim();
        if (!uuid) return;
        this.searching = true;
        try {
            const result = await feedbackApi.queryByUuid([uuid]);
            if (result.length === 0) {
                this.$message.warning(this.$t("feedback.searchUuidNotFound").toString());
                return;
            }
            this.selected = result[0];
        } catch (error) {
            console.warn(error);
        } finally {
            this.searching = false;
        }
    }

    // 把手动输入的 uuid 存进本地历史，方便下次打开时不用再手动查找
    // （例如用户在另一台设备提交、把 uuid 记在别处后想同步回本机）
    private async saveSearchedUuid() {
        const uuid = this.searchUuid.trim();
        if (!uuid) return;
        if (this.historyEntries.some(e => e.uuid === uuid)) {
            this.$message.warning(this.$t("feedback.searchUuidAlreadySaved").toString());
            return;
        }
        this.searching = true;
        try {
            const result = await feedbackApi.queryByUuid([uuid]);
            if (result.length === 0) {
                this.$message.warning(this.$t("feedback.searchUuidNotFound").toString());
                return;
            }
            feedbackStorage.add(uuid);
            this.historyEntries = feedbackStorage.getAll();
            this.items.push(result[0]);
            this.$message.success(this.$t("feedback.searchUuidSaved").toString());
        } catch (error) {
            console.warn(error);
        } finally {
            this.searching = false;
        }
    }

    private truncate(text: string): string {
        return text.length > 36 ? text.slice(0, 36) + "…" : text;
    }

    private back() {
        this.composeFiles.forEach(file => {
            const url = this.composePreviewUrls.get(file);
            if (url) URL.revokeObjectURL(url);
        });
        this.composeFiles = [];
        this.composePreviewUrls.clear();
        this.composeMessage = "";
        this.selected = null;
    }

    private async copyText(text: string) {
        await Tools.copyText(text);
        this.$message.success(this.$t("feedback.copySuccess").toString());
    }

    // 兼容过渡期：后端还没升级或响应里 messages 字段缺失时，退化为单条描述+单条回复
    private threadMessages(item: FeedbackPublicItem): FeedbackMessage[] {
        if (item.messages && item.messages.length > 0) return item.messages;
        const fallback: FeedbackMessage[] = [
            { role: "client", message: item.description, attachments: [], created_at: item.created_at },
        ];
        if (item.reply) {
            fallback.push({
                role: "admin",
                message: item.reply,
                attachments: item.reply_attachments ?? [],
                created_at: item.created_at,
            });
        }
        return fallback;
    }

    private isImage(file: File): boolean {
        return file.type.startsWith("image/");
    }

    private addComposeFiles(files: File[]) {
        files.forEach(file => {
            this.composeFiles.push(file);
            if (this.isImage(file)) {
                this.composePreviewUrls.set(file, URL.createObjectURL(file));
            }
        });
    }

    private removeComposeFile(index: number) {
        const [file] = this.composeFiles.splice(index, 1);
        const url = this.composePreviewUrls.get(file);
        if (url) {
            URL.revokeObjectURL(url);
            this.composePreviewUrls.delete(file);
        }
    }

    private openComposeFilePicker() {
        (this.$refs.composeFileInput as HTMLInputElement).click();
    }

    private onComposeFileInputChange(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files) {
            this.addComposeFiles(Array.from(input.files));
        }
        input.value = "";
    }

    private onPaste(e: ClipboardEvent) {
        if (!this.selected) return;
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
        if (files.length) this.addComposeFiles(files);
    }

    private async sendMessage() {
        if (!this.selected) return;
        const text = this.composeMessage.trim();
        if (!text && this.composeFiles.length === 0) return;

        this.sending = true;
        try {
            await feedbackApi.sendMessage(this.selected.uuid, text, this.composeFiles);
            const uuid = this.selected.uuid;

            this.composeFiles.forEach(file => {
                const url = this.composePreviewUrls.get(file);
                if (url) URL.revokeObjectURL(url);
            });
            this.composeFiles = [];
            this.composePreviewUrls.clear();
            this.composeMessage = "";

            const result = await feedbackApi.queryByUuid([uuid]);
            if (result.length > 0) {
                this.selected = result[0];
                const idx = this.items.findIndex(i => i.uuid === uuid);
                if (idx >= 0) this.items.splice(idx, 1, result[0]);
                else this.items.push(result[0]);
            }
        } catch (error) {
            console.warn(error);
            this.$message.warning(this.$t("feedback.messageSendFailed").toString());
        } finally {
            this.sending = false;
        }
    }

    protected override renderFooter(): any {
        if (this.selected) {
            return (
                <div class="dialog-footer">
                    <MyButton text={this.$t("feedback.back").toString()} onClick={this.back} />
                </div>
            );
        }
        return (
            <div class="dialog-footer">
                <MyButton text={this.$t("confirm.cancel").toString()} onClick={() => this.close()} />
            </div>
        );
    }

    private renderSearchBar(): VNode {
        return (
            <div class={s.searchBar}>
                <el-input
                    v-model={this.searchUuid}
                    placeholder={this.$t("feedback.searchUuidPlaceholder").toString()}
                    clearable
                    onKeyup={(e: KeyboardEvent) => { if (e.key === "Enter") this.searchByUuid(); }}
                />
                <el-button
                    type="primary"
                    icon="el-icon-search"
                    loading={this.searching}
                    onClick={() => this.searchByUuid()}
                >
                    {this.$t("feedback.searchUuidButton")}
                </el-button>
                <el-button
                    icon="el-icon-plus"
                    loading={this.searching}
                    onClick={() => this.saveSearchedUuid()}
                >
                    {this.$t("feedback.searchUuidSaveButton")}
                </el-button>
            </div>
        );
    }

    private renderList(): VNode {
        if (this.historyEntries.length === 0) {
            return (
                <div>
                    {this.renderSearchBar()}
                    <div class={s.empty}>{this.$t("feedback.historyEmpty")}</div>
                </div>
            );
        }
        return (
            <div>
                {this.renderSearchBar()}
                {this.loading && <div class={s.syncing}>{this.$t("feedback.historySyncing")}</div>}
                <div class={s.list}>
                    {this.historyEntries.map(entry => {
                        const item = this.items.find(i => i.uuid === entry.uuid);
                        return (
                            <div
                                key={entry.uuid}
                                class={[s.listItem, !item && s.listItemLoading]}
                                onClick={() => { if (item) this.selected = item; }}
                            >
                                <div class={s.listItemTitle}>
                                    {item ? this.truncate(item.description) : this.$t("loading")}
                                </div>
                                {item && <div class={s.listItemMeta}>{item.created_at}</div>}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    private renderDetail(item: FeedbackPublicItem): VNode {
        const machines = item.machines ? item.machines.split(",").map(m => m.trim()).filter(Boolean) : [];
        return (
            <div class={s.detail}>
                <div class={s.topRow}>
                    <div class={s.inlineGroup}>
                        <div class={s.inlineLabel}>{this.$t("feedback.createdAt")}</div>
                        <div class={s.detailValue}>{item.created_at}</div>
                    </div>
                    <div class={s.inlineGroup}>
                        <div class={s.inlineLabel}>{this.$t("feedback.sendLog")}</div>
                        <el-tag size="mini" type={item.send_log ? "success" : "info"}>
                            {item.send_log ? this.$t("feedback.yes") : this.$t("feedback.no")}
                        </el-tag>
                    </div>
                </div>

                <div class={s.fieldRow}>
                    <div class={s.inlineLabel}>{this.$t("feedback.ticketId")}</div>
                    <div class={s.tagCopyRow}>
                        <el-tag size="mini" type="warning">{item.uuid}</el-tag>
                        <el-button type="text" icon="el-icon-document-copy" onClick={() => this.copyText(item.uuid)} />
                    </div>
                </div>

                <div class={s.fieldRow}>
                    <div class={s.inlineLabel}>{this.$t("feedback.relatedMachines")}</div>
                    {machines.length
                        ? <div class={s.tagCopyRow}>
                            <div class={s.machineTags}>
                                {machines.map(m => <el-tag key={m} size="mini">{m}</el-tag>)}
                            </div>
                            <el-button type="text" icon="el-icon-document-copy" onClick={() => this.copyText(machines.join("\n"))} />
                        </div>
                        : <div class={s.detailValue}>-</div>
                    }
                </div>

                {this.renderThread(item)}
                {this.renderComposeBox()}
            </div>
        );
    }

    private renderThread(item: FeedbackPublicItem): VNode {
        const messages = this.threadMessages(item);
        return (
            <div class={s.thread}>
                {messages.map((msg, index) => (
                    <div key={index} class={[s.messageRow, msg.role === "admin" ? s.messageRowAdmin : null]}>
                        <div class={s.messageMeta}>
                            <span>{msg.role === "admin" ? this.$t("feedback.roleAdmin") : this.$t("feedback.roleClient")}</span>
                            <span>{msg.created_at}</span>
                        </div>
                        {msg.message && (
                            <div class={[s.messageBubble, msg.role === "admin" ? s.messageBubbleAdmin : s.messageBubbleClient]}>
                                {msg.message}
                            </div>
                        )}
                        {msg.attachments?.isNotEmpty && (
                            <div class={s.messageAttachments}>
                                {msg.attachments.map(path => (
                                    <el-image
                                        key={path}
                                        class={s.messageAttachmentThumb}
                                        src={feedbackApi.messageAttachmentUrl(item.uuid, path)}
                                        preview-src-list={msg.attachments.map(p => feedbackApi.messageAttachmentUrl(item.uuid, p))}
                                        fit="cover"
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    private renderComposeBox(): VNode {
        return (
            <div class={s.composeBox}>
                <el-input
                    type="textarea"
                    rows={2}
                    v-model={this.composeMessage}
                    placeholder={this.$t("feedback.messagePlaceholder").toString()}
                />
                <div class={s.composeToolbar}>
                    <div class={s.composeAttachments}>
                        {this.composeFiles.map((file, index) => (
                            <div class={s.composeAttachmentItem} key={index}>
                                {this.isImage(file)
                                    ? <img class={s.composeAttachmentImage} src={this.composePreviewUrls.get(file)} />
                                    : <div class={s.composeAttachmentFile}>
                                        <i class="el-icon-document" />
                                        <span class={s.composeAttachmentFileName}>{file.name}</span>
                                    </div>
                                }
                                <div class={s.composeAttachmentRemove} onClick={() => this.removeComposeFile(index)}>
                                    <i class="el-icon-close" />
                                </div>
                            </div>
                        ))}
                        <div class={s.composeAttachmentAdd} onClick={this.openComposeFilePicker}>
                            <i class="el-icon-plus" />
                        </div>
                    </div>
                    <el-button
                        type="primary"
                        size="mini"
                        loading={this.sending}
                        onClick={() => this.sendMessage()}
                    >
                        {this.$t("feedback.send")}
                    </el-button>
                </div>
                <input
                    ref="composeFileInput"
                    type="file"
                    multiple
                    class={s.attachmentInput}
                    onChange={this.onComposeFileInputChange}
                />
            </div>
        );
    }

    protected renderDialog(): VNode {
        return (
            <div class={s.dialogBody}>
                {this.selected ? this.renderDetail(this.selected) : this.renderList()}
            </div>
        );
    }
}
