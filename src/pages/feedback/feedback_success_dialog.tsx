import { Tools } from "@/common/common";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { MyButton } from "@/lib/my_button";
import { VNode } from "vue";
import s from './feedback_success_dialog.module.less';

@Dialog
export class FeedbackSuccessDialog extends CommonDialog<string, void> {
    public override width = "460px";

    public override show(data: string) {
        this.title = this.$t("feedback.successTitle").toString();
        return super.show(data);
    }

    private async copyUuid() {
        await Tools.copyText(this.data);
        this.$message.success(this.$t("feedback.copySuccess").toString());
    }

    protected override renderFooter(): any {
        return (
            <div class="dialog-footer">
                <MyButton text={this.$t("confirm.ok").toString()} type="primary" onClick={() => this.close()} />
            </div>
        );
    }

    protected renderDialog(): VNode {
        return (
            <div class={s.body}>
                <div class={s.hint}>{this.$t("feedback.successHint")}</div>
                <div class={s.uuidRow}>
                    <el-input value={this.data} readonly />
                    <el-button type="primary" icon="el-icon-document-copy" onClick={() => this.copyUuid()}>
                        {this.$t("feedback.copy")}
                    </el-button>
                </div>
            </div>
        );
    }
}
