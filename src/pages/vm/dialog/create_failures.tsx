import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { Column } from "@/lib/container";
import { MyButton } from "@/lib/my_button";
import { VNode } from "vue";
import { CONTAINER_LIMIT_EXCEEDED_CODE } from "@/api/api_base";

export interface CreateFailureItem {
    index: number;
    name: string;
    message: string;
    /** super_sdk 响应码（仅在失败来自 super_sdk 的非 200 响应时有值） */
    code?: number;
}

export interface CreateFailuresData {
    failures: CreateFailureItem[];
    /** 打开“开通VIP”流程；提供后，只要有失败项是v3云机数量超限，页脚就显示开通VIP按钮 */
    onOpenVip?: () => Promise<void>;
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

    // 任意一台失败是因为v3云机数量超限，就提供开通VIP入口（开通VIP后上限不再生效）
    private get hasLimitFailure(): boolean {
        return this.data.failures.some(f => f.code === CONTAINER_LIMIT_EXCEEDED_CODE);
    }

    protected override renderFooter() {
        return (
            <div class="dialog-footer">
                {this.data.onOpenVip && this.hasLimitFailure && (
                    <MyButton text={this.$t("create.openVip")} onClick={() => this.data.onOpenVip!()} type="primary" plain />
                )}
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
