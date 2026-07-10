import { feedbackApi } from "@/api/feedback_api";
import { FeedbackPublicItem } from "@/api/feedback_define";
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

    public override async show() {
        this.title = this.$t("feedback.historyTitle").toString();
        // 先用本地缓存的 uuid 列表把条目数/顺序显示出来，标题文本等查询结果回来再补上
        this.historyEntries = feedbackStorage.getAll();
        this.loadItems();
        return super.show();
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

    private truncate(text: string): string {
        return text.length > 36 ? text.slice(0, 36) + "…" : text;
    }

    private back() {
        this.selected = null;
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
        return (
            <div class={s.detail}>
                <div class={s.detailRow}>
                    <div class={s.detailLabel}>{this.$t("feedback.description")}</div>
                    <div class={s.detailValue}>{item.description}</div>
                </div>
                <div class={s.detailRow}>
                    <div class={s.detailLabel}>{this.$t("feedback.relatedMachines")}</div>
                    <div class={s.detailValue}>{item.machines || "-"}</div>
                </div>
                <div class={s.detailRow}>
                    <div class={s.detailLabel}>{this.$t("feedback.sendLog")}</div>
                    <div class={s.detailValue}>{item.send_log ? this.$t("feedback.yes") : this.$t("feedback.no")}</div>
                </div>
                <div class={s.detailRow}>
                    <div class={s.detailLabel}>{this.$t("feedback.reply")}</div>
                    <div class={s.detailValue}>{item.reply || this.$t("feedback.noReply")}</div>
                </div>
                <div class={s.detailRow}>
                    <div class={s.detailLabel}>{this.$t("feedback.createdAt")}</div>
                    <div class={s.detailValue}>{item.created_at}</div>
                </div>
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
