import { deviceApi, PullImageAbortError } from '@/api/device_api';
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { MyButton } from "@/lib/my_button";
import s from "./pull_image.module.less";

interface PullImageRequest {
    hostIp: string;
    imageAddress: string;
    dockerRegistry?: string;
}

export interface PullImageResult {
    /** 用户点了取消，调用方应静默中止后续流程 */
    canceled?: boolean;
    /** 拉取失败的原因，成功时为空 */
    error?: string;
}

@Dialog
export class PullImageDialog extends CommonDialog<PullImageRequest, PullImageResult> {
    public override width: string = "550px";
    private progress = 0;
    private controller = new AbortController();
    public override allowEscape: boolean = false;
    public override title: string = this.$t("pullImage.title").toString();

    public override show(data: PullImageRequest) {
        deviceApi.pullImageProgress(data.hostIp, data.imageAddress, data.dockerRegistry ?? "", (progress) => {
            // console.log(progress);
            this.progress = progress;
        }, this.controller.signal).then(() => {
            this.close({});
        }).catch((e) => {
            // 取消的场景由 onCancel 负责关闭，这里不再当作失败上报
            if (e instanceof PullImageAbortError) return;
            console.error(e);
            const reason = e instanceof Error ? e.message : `${e}`;
            const failed = this.$t("pullImage.failed").toString();
            this.close({ error: reason ? `${failed}: ${reason}` : failed });
        });
        return super.show(data);
    }

    /** 镜像地址不存在或仓库不可达时，服务端的 docker pull 可能长时间没有响应，
     *  这个弹窗既没有关闭按钮也不响应 ESC，必须留一个取消的口子，否则界面会一直卡住 */
    private onCancel() {
        this.controller.abort();
        this.close({ canceled: true });
    }

    protected override renderHeader(): any {
        return (
            <div class="dialog-header">
                <div class="dialog-title">{this.title}</div>
            </div>
        );
    }

    protected override renderFooter() {
        return (
            <div class="dialog-footer">
                <MyButton text={this.$t("confirm.cancel")} onClick={() => this.onCancel()} />
            </div>
        );
    }

    protected override renderDialog() {
        return <div class={s.pullImageDialog}>
            <div class={s.progressContainer}>
                <div class={s.progressBar} style={{ clipPath: `inset(0 ${100 - this.progress}% 0 0)` }}></div>
                <div class={s.progressText}>{`${this.progress.toFixed(2)}%`}</div>
            </div>
        </div>;
    }
}
