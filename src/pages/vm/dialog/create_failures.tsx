import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { Column } from "@/lib/container";
import { MyButton } from "@/lib/my_button";
import { VNode } from "vue";

export interface CreateFailureItem {
    index: number;
    name: string;
    message: string;
}

export interface CreateFailuresData {
    failures: CreateFailureItem[];
}

/** 批量创建云机时，展示每个失败实例位的详细原因 */
@Dialog
export class CreateFailuresDialog extends CommonDialog<CreateFailuresData, void> {
    public override width: string = "600px";
    public override height: string = "400px";

    public override show(data: CreateFailuresData) {
        this.title = this.$t("create.failuresTitle").toString();
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
                    <el-table-column
                        label={this.$t("create.failuresIndex")}
                        prop="index"
                        width="80"
                    />
                    <el-table-column
                        label={this.$t("create.failuresName")}
                        prop="name"
                        width="160"
                    />
                    <el-table-column
                        label={this.$t("create.failuresReason")}
                        prop="message"
                    />
                </el-table>
            </Column>
        );
    }
}
