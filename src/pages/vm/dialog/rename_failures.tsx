import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { Column } from "@/lib/container";
import { MyButton } from "@/lib/my_button";
import { VNode } from "vue";

export interface RenameFailureItem {
    hostIp: string;
    index: number;
    name: string;
    message: string;
}

export interface RenameFailuresData {
    failures: RenameFailureItem[];
}

/** 批量重命名时，展示每个失败实例的详细原因 */
@Dialog
export class RenameFailuresDialog extends CommonDialog<RenameFailuresData, void> {
    public override width: string = "650px";
    public override height: string = "400px";

    public override show(data: RenameFailuresData) {
        this.title = this.$t("batch.renameFailuresTitle").toString();
        return super.show(data);
    }

    protected override renderFooter() {
        return (
            <div class="dialog-footer">
                <MyButton text={this.$t("confirm.ok")} onClick={() => this.close()} type="primary" />
            </div>
        );
    }

    protected renderDialog(): VNode {
        return (
            <Column gap={10} style={{ padding: "20px", height: "100%" }}>
                <el-table data={this.data.failures} height="100%">
                    <el-table-column label={this.$t("batch.renamePreviewHost")} prop="hostIp" width="140" />
                    <el-table-column label={this.$t("batch.renamePreviewSlot")} prop="index" width="80" />
                    <el-table-column label={this.$t("batch.renamePreviewNewName")} prop="name" />
                    <el-table-column label={this.$t("batch.renameFailuresReason")} prop="message" />
                </el-table>
            </Column>
        );
    }
}
