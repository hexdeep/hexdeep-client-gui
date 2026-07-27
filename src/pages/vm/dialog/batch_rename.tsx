import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { VNode } from "vue";
import { deviceApi } from '@/api/device_api';
import { i18n } from "@/i18n/i18n";
import { DeviceInfo } from "@/api/device_define";
import { getSuffixName } from "@/common/common";
import { RenameFailureItem, RenameFailuresDialog } from './rename_failures';

interface PreviewRow {
    hostIp: string;
    index: number;
    oldName: string;
    newName: string;
}

/** 批量重命名：新名称 = 用户输入的基础名称 + 各云机自己的实例位编号 */
@Dialog
export class BatchRenameDialog extends CommonDialog<DeviceInfo[], boolean> {
    public override width: string = "700px";
    public override height: string = "550px";
    private baseName: string = "";
    private pendingFailures: RenameFailureItem[] = [];
    private pendingSucceeded = 0;

    public override show(data: DeviceInfo[]) {
        this.title = this.$t("batch.renameTitle").toString();
        this.baseName = "";
        this.pendingFailures = [];
        this.pendingSucceeded = 0;
        return super.show(data);
    }

    private get previewRows(): PreviewRow[] {
        return this.data.map(item => ({
            hostIp: item.hostIp,
            index: item.index,
            oldName: getSuffixName(item.name),
            newName: `${this.baseName}${item.index}`,
        }));
    }

    private get formRules() {
        return {
            baseName: [
                { required: true, message: i18n.t("notNull"), trigger: 'blur' },
                { min: 1, max: 18, message: i18n.t("batch.renameBaseNameLength"), trigger: 'blur' },
                { pattern: /^[a-zA-Z0-9_]*$/, message: i18n.t("noMinus"), trigger: 'blur' },
            ],
        };
    }

    @ErrorProxy({ validatForm: "formRef" })
    protected override async onConfirm() {
        await this.doRename();
        await this.showPendingFailures();
    }

    @ErrorProxy({ loading: i18n.t("loading") })
    private async doRename() {
        const rows = this.previewRows;
        const results = await Promise.allSettled(
            this.data.map((item, i) => deviceApi.rename(item.hostIp, item.name, rows[i].newName))
        );
        const failed = results
            .map((r, i) => ({ r, row: rows[i] }))
            .filter(x => x.r.status === "rejected") as { r: PromiseRejectedResult; row: PreviewRow }[];

        if (failed.length === 0) {
            this.$message.success(i18n.t("batch.renameSuccess", [this.data.length]).toString());
            this.close(true);
            return;
        }

        this.pendingSucceeded = results.length - failed.length;
        this.pendingFailures = failed.map(({ r, row }) => ({
            hostIp: row.hostIp,
            index: row.index,
            name: row.newName,
            message: r.reason instanceof Error ? r.reason.message : String(r.reason),
        }));
    }

    // doRename() 全程处于 @ErrorProxy 的全屏 loading 遮罩之下（z-index >= 2000 且 lock），
    // 自定义弹窗的遮罩固定是 999，此时打开 RenameFailuresDialog 会被压在遮罩底下点不到、
    // await 永远不返回、loading 也就永远关不掉。必须等 doRename 的 loading 关闭之后，
    // 在 onConfirm 里再展示失败详情（同 create.tsx 的处理方式）。
    private async showPendingFailures() {
        if (this.pendingFailures.length === 0) return;
        const failures = this.pendingFailures;
        const succeeded = this.pendingSucceeded;
        this.pendingFailures = [];
        this.pendingSucceeded = 0;
        await this.$dialog(RenameFailuresDialog).show({ failures });
        // 只要有一部分成功，就关闭弹窗触发列表刷新；全部失败则留在弹窗里方便用户改名重试
        if (succeeded > 0) {
            this.close(true);
        }
    }

    protected renderDialog(): VNode {
        return (
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%", gap: "12px" }}>
                <el-form ref="formRef" props={{ model: this }} rules={this.formRules} label-width="100px">
                    <el-form-item label={this.$t("batch.renameBaseName")} prop="baseName">
                        <el-input v-model={this.baseName} maxlength={18} nativeOnKeyup={(e: KeyboardEvent) => e.key === "Enter" && this.onConfirm()} />
                        <div style={{ color: "#909399", fontSize: "12px", marginTop: "4px" }}>{this.$t("batch.renameBaseNameTip")}</div>
                    </el-form-item>
                </el-form>
                <el-table data={this.previewRows} height="100%" size="small" style={{ flex: "1" }}>
                    <el-table-column label={this.$t("batch.renamePreviewHost")} prop="hostIp" width="140" />
                    <el-table-column label={this.$t("batch.renamePreviewSlot")} prop="index" width="80" />
                    <el-table-column label={this.$t("batch.renamePreviewOldName")} prop="oldName" />
                    <el-table-column label={this.$t("batch.renamePreviewNewName")} prop="newName" />
                </el-table>
            </div>
        );
    }
}
