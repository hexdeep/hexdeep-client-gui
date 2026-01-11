import { deviceApi } from '@/api/device_api';
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import s from "./pull_image.module.less";

interface PullImageRequest {
    hostIp: string;
    imageAddress: string;
    dockerRegistry?: string;
}

@Dialog
export class PullImageDialog extends CommonDialog<PullImageRequest, void | string> {
    public override width: string = "550px";
    private progress = 0;
    public override allowEscape: boolean = false;
    public override title: string = this.$t("pullImage.title").toString();

    public override show(data: PullImageRequest) {
        if (data.dockerRegistry) {
            deviceApi.pullImageFromRegistry(data.hostIp, data.imageAddress, data.dockerRegistry, (progress) => {
                // console.log(progress);
                this.progress = progress;
            }).then(() => {
                this.close();
            }).catch((e) => {
                console.error(e);
                this.close(this.$t("pullImage.failed").toString());
            });
        } else {
            deviceApi.pullImageProgress(data.hostIp, data.imageAddress, (progress) => {
                // console.log(progress);
                this.progress = progress;
            }).then(() => {
                this.close();
            }).catch((e) => {
                console.error(e);
                this.close(this.$t("pullImage.failed").toString());
            });
        }


        return super.show(data);
    }

    protected override renderHeader(): any {
        return (
            <div class="dialog-header">
                <div class="dialog-title">{this.title}</div>
            </div>
        );
    }

    protected override renderFooter() {
        // ignore
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