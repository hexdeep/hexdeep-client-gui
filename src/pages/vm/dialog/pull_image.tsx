import { deviceApi } from '@/api/device_api';
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
    private pullTask: { promise: Promise<any>, cancel: () => void; } | null = null;
    public override allowEscape: boolean = false;
    public override title: string = this.$t("pullImage.title").toString();

    public override show(data: PullImageRequest) {
        this.pullTask = deviceApi.pullImages(
            data.hostIp,
            data.imageAddress,
            undefined,
            (percent) => {
                // percent<0 表示服务端此时无法计算具体百分比（比如走普通 registry docker pull），
                // 保留上一次已知的百分比，不倒退成 0，也不让进度条乱跳。
                if (percent >= 0) this.progress = percent;
            },
            data.dockerRegistry
        );
        this.pullTask.promise.then(() => {
            this.close({});
        }).catch((e: any) => {
            // 取消的场景由 onCancel 负责关闭，这里不再当作失败上报（pullImages 的 cancel()
            // 用字符串 "aborted" 拒绝 promise，和 manage_images_dialog.tsx 里的约定一致）
            if (e === "aborted") return;
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
        this.pullTask?.cancel();
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
