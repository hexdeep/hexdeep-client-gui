import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from "@/api/device_api";
import { i18n } from "@/i18n/i18n";
import { HostInfo, StartupInfo } from "@/api/device_define";
import { Column, Row } from "@/lib/container";
import { MyButton } from "@/lib/my_button";

/** 列表自动刷新间隔：启动项进程可能自己退出（V1不做崩溃自动重启），要能看出来 */
const REFRESH_INTERVAL = 3000;

interface StartupFormData {
    host: HostInfo;
    /** 有值表示编辑已有启动项，编辑模式不允许换可执行文件 */
    item?: StartupInfo;
}

interface StartupLogsData {
    host: HostInfo;
    item: StartupInfo;
}

@Dialog
export class StartupFormDialog extends CommonDialog<StartupFormData, boolean> {
    public override width: string = "520px";
    protected name: string = "";
    protected command: string = "";
    protected file: File | null = null;
    protected submitting: boolean = false;
    protected uploadProgress: number = 0;
    protected uploadTask: { promise: Promise<any>, cancel: () => void; } | null = null;

    private get isEditMode(): boolean {
        return !!this.data.item;
    }

    public override show(data: StartupFormData) {
        this.title = this.$t(data.item ? "startup.editTitle" : "startup.addTitle").toString();
        if (data.item) {
            this.name = data.item.name;
            this.command = data.item.command;
        }
        return super.show(data);
    }

    public override close(result?: boolean): Promise<boolean> {
        if (this.uploadTask) this.uploadTask.cancel();
        return super.close(result);
    }

    private onFileChange(file: any) {
        this.file = file?.raw ?? file ?? null;
        // 名称留空时用文件名兜底，省得每次都手输一遍
        if (this.file && !this.name.trim()) {
            this.name = this.file.name;
        }
    }

    /** startNow 只在新增时有意义：对应底部的"确定"和"确定并启动"两个按钮 */
    protected async submit(startNow: boolean) {
        if (this.submitting) return;
        if (!this.name.trim()) {
            this.$message.error(this.$t("startup.nameRequired").toString());
            return;
        }
        if (!this.isEditMode && !this.file) {
            this.$message.error(this.$t("startup.fileRequired").toString());
            return;
        }

        this.submitting = true;
        this.uploadProgress = 0;
        try {
            if (this.isEditMode) {
                await deviceApi.updateStartup(
                    this.data.host.address,
                    this.data.item!.id,
                    this.name.trim(),
                    this.command.trim()
                );
            } else {
                this.uploadTask = deviceApi.addStartup(
                    this.data.host.address,
                    {
                        name: this.name.trim(),
                        file: this.file!,
                        command: this.command.trim(),
                        start: startNow,
                    },
                    percent => this.uploadProgress = Math.max(0, Math.min(100, percent))
                );
                await this.uploadTask.promise;
            }
            this.$message.success(this.$t("startup.saveSuccess").toString());
            await this.close(true);
        } catch (error) {
            if (error !== "aborted") {
                this.$alert(`${error}`, this.$t("error").toString(), { type: "error" });
            }
        } finally {
            this.uploadTask = null;
            this.submitting = false;
        }
    }

    protected renderDialog(): VNode {
        return (
            <el-form label-position="top" style={{ padding: "20px" }}>
                <el-form-item label={this.$t("startup.name")}>
                    <el-input
                        v-model={this.name}
                        disabled={this.submitting}
                        placeholder={this.$t("startup.namePlaceholder")}
                    />
                </el-form-item>
                {this.isEditMode ? (
                    <el-form-item label={this.$t("startup.file")}>
                        <span style={{ color: "#909399" }}>
                            {this.data.item!.filename} ({this.$t("startup.fileNotEditable")})
                        </span>
                    </el-form-item>
                ) : (
                    <el-form-item label={this.$t("startup.file")}>
                        <el-upload
                            action="#"
                            multiple={false}
                            limit={1}
                            auto-upload={false}
                            disabled={this.submitting}
                            attrs={{ "on-change": this.onFileChange }}
                            on-remove={() => { this.file = null; }}
                        >
                            <MyButton size="small" disabled={this.submitting} text={this.$t("startup.selectFile")} />
                        </el-upload>
                        <div style={{ fontSize: "12px", color: "#909399", lineHeight: "1.6" }}>
                            {this.$t("startup.fileTip")}
                        </div>
                    </el-form-item>
                )}
                <el-form-item label={this.$t("startup.command")}>
                    <el-input
                        v-model={this.command}
                        disabled={this.submitting}
                        placeholder={this.defaultCommandHint()}
                    />
                    <div style={{ fontSize: "12px", color: "#909399", lineHeight: "1.6" }}>
                        {this.$t("startup.commandTip")}
                    </div>
                </el-form-item>
                {this.submitting && !this.isEditMode && (
                    <el-form-item>
                        <el-progress percentage={this.uploadProgress} />
                    </el-form-item>
                )}
            </el-form>
        );
    }

    private defaultCommandHint(): string {
        const filename = this.data.item?.filename ?? this.file?.name;
        return filename ? `./${filename}` : this.$t("startup.commandPlaceholder").toString();
    }

    protected override renderFooter() {
        return (
            <div class="dialog-footer">
                <MyButton
                    type="primary"
                    disabled={this.submitting}
                    text={this.submitting ? this.$t("loading") : this.$t("confirm.ok")}
                    onClick={() => this.submit(false)}
                />
                {!this.isEditMode && (
                    <MyButton
                        type="primary"
                        plain
                        disabled={this.submitting}
                        text={this.$t("startup.okAndStart")}
                        onClick={() => this.submit(true)}
                    />
                )}
                <MyButton text={this.$t("confirm.cancel")} onClick={() => this.close()} />
            </div>
        );
    }
}

@Dialog
export class StartupLogsDialog extends CommonDialog<StartupLogsData, void> {
    public override width: string = "800px";
    public override height: string = "600px";
    protected logs: string = "";
    protected loading: boolean = true;
    // SSE 连接状态，仅用于界面上那个小圆点提示；断线后 EventSource 会按规范自动重连，
    // 这里不需要也不应该手动重试
    protected connected: boolean = true;
    private unsubscribe?: () => void;

    public override async show(data: StartupLogsData) {
        this.title = `${this.$t("startup.logsTitle")} - ${data.item.name}`;
        this.data = data;
        this.loading = true;
        this.unsubscribe = deviceApi.subscribeStartupLogs(
            data.host.address,
            data.item.id,
            e => this.onLogEvent(e),
            connected => this.connected = connected,
        );
        return super.show(data);
    }

    protected destroyed() {
        this.unsubscribe?.();
    }

    private onLogEvent(e: { init: boolean; text: string; }) {
        this.loading = false;

        if (e.init) {
            // 首次连接推过来的是完整尾部，直接替换，并且不管之前滚动到哪都要跳到最新
            this.logs = e.text;
            this.$nextTick(() => this.scrollToBottom());
            return;
        }

        if (!e.text) return; // 这一次 tick 没有新内容

        // 只有原本就停在最底部时才跟着滚动，用户往上翻看历史日志时不能被新日志打断
        const wasAtBottom = this.isAtBottom();
        this.logs += e.text;
        this.$nextTick(() => {
            if (wasAtBottom) this.scrollToBottom();
        });
    }

    private isAtBottom(): boolean {
        const el = this.$refs.logBox as HTMLElement | undefined;
        if (!el) return true;
        // 留一点容差：不同浏览器对"滚动到底"的 scrollHeight/scrollTop 计算会有 1px 左右的抖动
        return el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    }

    private scrollToBottom() {
        const el = this.$refs.logBox as HTMLElement | undefined;
        if (el) el.scrollTop = el.scrollHeight;
    }

    protected renderDialog(): VNode {
        return (
            <Column gap={12} style={{ padding: "20px", height: "100%", minHeight: 0 }}>
                <Row crossAlign="center" gap={10}>
                    <span style={{ color: "#909399", fontSize: "12px" }}>{this.$t("startup.logsTip")}</span>
                    <Row crossAlign="center" gap={4} class="ms-auto shrink-0">
                        <span
                            style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: this.connected ? "#67C23A" : "#E6A23C",
                                display: "inline-block",
                            }}
                        />
                        <span style={{ fontSize: "12px", color: "#909399" }}>
                            {this.connected ? this.$t("startup.logsLive") : this.$t("startup.logsReconnecting")}
                        </span>
                    </Row>
                </Row>
                <div
                    ref="logBox"
                    v-loading={this.loading}
                    style={{
                        flex: "1",
                        minHeight: 0,
                        overflow: "auto",
                        background: "#1e1e1e",
                        color: "#d4d4d4",
                        padding: "12px",
                        borderRadius: "4px",
                        fontFamily: "monospace",
                        fontSize: "12px",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                    }}
                >
                    {this.logs || this.$t("startup.noLogs")}
                </div>
            </Column>
        );
    }

    protected override renderFooter() {
        return (
            <div class="dialog-footer">
                <MyButton text={this.$t("confirm.cancel")} onClick={() => this.close()} />
            </div>
        );
    }
}

@Dialog
export class StartupDialog extends CommonDialog<HostInfo, boolean> {
    public override width: string = "980px";
    public override height: string = "620px";

    protected startups: StartupInfo[] = [];
    protected selectedIds: number[] = [];
    protected loading: boolean = false;
    private refreshTimer?: number;

    public override async show(data: HostInfo) {
        this.title = this.$t("startup.title").toString() + ` (${data.address})`;
        this.data = data;
        this.loadStartups();
        // 定时刷新只更新运行状态，不动选中项：进程可能自己退出，界面得跟上
        this.refreshTimer = window.setInterval(() => this.loadStartups(true), REFRESH_INTERVAL);
        return super.show(data);
    }

    protected destroyed() {
        if (this.refreshTimer) window.clearInterval(this.refreshTimer);
    }

    /** silent 用于后台定时刷新：不显示 loading 遮罩，也不弹错误，免得打断操作 */
    private async loadStartups(silent: boolean = false) {
        if (!silent) this.loading = true;
        try {
            this.startups = await deviceApi.getStartups(this.data.address);
        } catch (e) {
            if (!silent) this.$message.error(`${e}`);
        } finally {
            if (!silent) this.loading = false;
        }
    }

    private onSelectionChange(selection: StartupInfo[]) {
        this.selectedIds = selection.map(item => item.id);
    }

    private async addStartup() {
        const saved = await this.$dialog(StartupFormDialog).show({ host: this.data });
        if (saved) await this.loadStartups();
    }

    private async editStartup(item: StartupInfo) {
        const saved = await this.$dialog(StartupFormDialog).show({ host: this.data, item });
        if (saved) await this.loadStartups();
    }

    private showLogs(item: StartupInfo) {
        this.$dialog(StartupLogsDialog).show({ host: this.data, item });
    }

    @ErrorProxy({ success: i18n.t("startup.startSuccess"), loading: i18n.t("loading") })
    private async startItem(item: StartupInfo) {
        await deviceApi.startStartup(this.data.address, item.id);
        await this.loadStartups();
    }

    @ErrorProxy({
        confirm: (_: StartupDialog, item: StartupInfo) => i18n.t("startup.stopConfirm", [item.name]),
        success: i18n.t("startup.stopSuccess"),
        loading: i18n.t("loading"),
    })
    private async stopItem(item: StartupInfo) {
        await deviceApi.stopStartup(this.data.address, item.id);
        await this.loadStartups();
    }

    @ErrorProxy({ success: i18n.t("startup.restartSuccess"), loading: i18n.t("loading") })
    private async restartItem(item: StartupInfo) {
        await deviceApi.restartStartup(this.data.address, item.id);
        await this.loadStartups();
    }

    @ErrorProxy({
        confirm: (self: StartupDialog) => i18n.t("startup.deleteConfirm", [self.selectedIds.length]),
        success: i18n.t("startup.deleteSuccess"),
        loading: i18n.t("loading"),
    })
    private async deleteSelected() {
        if (this.selectedIds.length === 0) return;
        const failed = await deviceApi.deleteStartups(this.data.address, this.selectedIds);
        this.selectedIds = [];
        await this.loadStartups();

        const failedIds = Object.keys(failed);
        if (failedIds.length > 0) {
            this.$alert(
                failedIds.map(id => `${id}: ${failed[id]}`).join("; "),
                this.$t("startup.deletePartialFailed").toString(),
                { type: "warning" }
            );
            return false;
        }
    }

    protected override renderFooter() {
        return (
            <div class="dialog-footer">
                <MyButton text={this.$t("confirm.cancel")} onClick={() => this.close(false)} />
            </div>
        );
    }

    protected renderDialog(): VNode {
        return (
            <Column gap={12} style={{ padding: "20px", height: "100%", minHeight: 0 }}>
                <Row crossAlign="center" gap={10}>
                    <MyButton type="primary" size="small" onClick={this.addStartup}>
                        {this.$t("startup.add")}
                    </MyButton>
                    {/* 按需求：只有勾选了才显示批量删除 */}
                    {this.selectedIds.length > 0 && (
                        <MyButton
                            type="danger"
                            plain
                            size="small"
                            onClick={this.deleteSelected}
                        >
                            {this.$t("startup.deleteSelected", [this.selectedIds.length])}
                        </MyButton>
                    )}
                    <span style={{ color: "#909399", fontSize: "12px", marginLeft: "auto" }}>
                        {this.$t("startup.tip")}
                    </span>
                </Row>
                <el-table
                    ref="startupTable"
                    data={this.startups}
                    height="100%"
                    v-loading={this.loading}
                    row-key="id"
                    empty-text={this.$t("startup.empty").toString()}
                    on-selection-change={this.onSelectionChange}
                >
                    <el-table-column type="selection" width="55" />
                    <el-table-column
                        type="index"
                        label={this.$t("startup.columnIndex")}
                        width="70"
                        align="center"
                    />
                    <el-table-column
                        label={this.$t("startup.columnName")}
                        min-width="140"
                        show-overflow-tooltip
                        prop="name"
                    />
                    <el-table-column
                        label={this.$t("startup.columnFile")}
                        min-width="140"
                        show-overflow-tooltip
                        prop="filename"
                    />
                    <el-table-column
                        label={this.$t("startup.columnCommand")}
                        min-width="160"
                        show-overflow-tooltip
                        prop="resolved_command"
                    />
                    <el-table-column
                        label={this.$t("startup.columnStatus")}
                        width="110"
                        align="center"
                        scopedSlots={{
                            default: ({ row }: { row: StartupInfo; }) => {
                                if (row.running) {
                                    return <span style={{ color: "#67C23A" }}>{this.$t("startup.running")} ({row.pid})</span>;
                                }
                                return <span style={{ color: "#909399" }}>{this.$t("startup.stopped")}</span>;
                            }
                        }}
                    />
                    <el-table-column
                        label={this.$t("action")}
                        width="260"
                        align="center"
                        scopedSlots={{
                            default: ({ row }: { row: StartupInfo; }) => (
                                <Row crossAlign="center" gap={4} mainAlign="center">
                                    {row.running ? (
                                        <el-button type="text" onClick={() => this.stopItem(row)}>
                                            {this.$t("startup.stop")}
                                        </el-button>
                                    ) : (
                                        <el-button type="text" onClick={() => this.startItem(row)}>
                                            {this.$t("startup.start")}
                                        </el-button>
                                    )}
                                    <el-button type="text" onClick={() => this.restartItem(row)}>
                                        {this.$t("startup.restart")}
                                    </el-button>
                                    <el-button type="text" onClick={() => this.editStartup(row)}>
                                        {this.$t("startup.edit")}
                                    </el-button>
                                    <el-button type="text" onClick={() => this.showLogs(row)}>
                                        {this.$t("startup.logs")}
                                    </el-button>
                                </Row>
                            )
                        }}
                    />
                </el-table>
            </Column>
        );
    }
}
