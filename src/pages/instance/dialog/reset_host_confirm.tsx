import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { VNode } from "vue";
import { HostInfo } from "@/api/device_define";
import { MyButton } from "@/lib/my_button";

const RESET_CONFIRM_WAIT_SECONDS = 5;

@Dialog
export class ResetHostConfirmDialog extends CommonDialog<HostInfo, boolean> {
    public override width: string = "480px";

    protected countdown: number = RESET_CONFIRM_WAIT_SECONDS;
    private timer: any;

    public override show(data: HostInfo) {
        this.title = this.$t("vmDetail.resetConfirmTitle").toString();
        this.countdown = RESET_CONFIRM_WAIT_SECONDS;
        this.timer = setInterval(() => {
            this.countdown--;
            if (this.countdown <= 0) {
                clearInterval(this.timer);
                this.timer = null;
            }
        }, 1000);
        return super.show(data);
    }

    protected destroyed() {
        if (this.timer) clearInterval(this.timer);
    }

    protected override onConfirm() {
        if (this.countdown > 0) return;
        this.close(true);
    }

    protected renderDialog(): VNode {
        return (
            <div style={{ lineHeight: "1.8", fontSize: "14px", color: "#606266", whiteSpace: "pre-line" }}>
                {this.$t("vmDetail.resetConfirmDesc")}
            </div>
        );
    }

    protected override renderFooter() {
        const confirmText = this.countdown > 0
            ? `${this.$t("confirm.ok")}(${this.countdown}s)`
            : (this.$t("confirm.ok") as string);
        return (
            <div class="dialog-footer">
                <MyButton
                    text={confirmText}
                    type="primary"
                    disabled={this.countdown > 0}
                    onClick={() => this.onConfirm()}
                />
                <MyButton text={this.$t("confirm.cancel") as string} onClick={() => this.close(false)} />
            </div>
        );
    }
}
