import { Component, InjectReactive, Prop, Ref } from 'vue-property-decorator';
import * as tsx from 'vue-tsx-support';
import { deviceApi } from '@/api/device_api';
import s from './dev_list.module.less';
import Vue from 'vue';
import { DeviceInfo } from '@/api/device_define';

@Component
export class Screenshot extends tsx.Component<IProps> {
    private static eventBus = new Vue();
    public static refresh() {
        this.eventBus.$emit("refresh");
    }
    @InjectReactive() view!: string;
    @Prop() private device!: DeviceInfo;
    @Ref() private canvasRef!: HTMLCanvasElement;
    private busy = false;

    protected async created() {
        this.refresh = async () => {
            if (this.device.state != "running") {
                var c = this.canvasRef;
                var ctx = c.getContext("2d")!;
                ctx.clearRect(0, 0, c.width, c.height);
                return;
            }
            if (this.busy) return;
            try {
                this.busy = true;
                var b = await deviceApi.screenshot(this.device.hostIp, this.device.name);
                if (b?.size > 100) {
                    this.updateImg(b);
                }
            } catch (error) {
                // console.error(error);
            } finally {
                this.busy = false;
            }
        };
        Screenshot.eventBus.$on("refresh", this.refresh);
        this.refresh();
    }

    protected destroyed() {
        if (this.refresh) Screenshot.eventBus.$off("refresh", this.refresh);
    }

    private refresh!: () => void;

    private async updateImg(blob: Blob) {
        const img = await createImageBitmap(blob);
        if (!img) return;
        var c = this.canvasRef;
        if (c) {
            if ((this.view == "vertical" && img.width < img.height) || (this.view == "horizontal" && img.width > img.height)) {
                if (c.width != img.width) {
                    var scale = img.width / img.height;
                    c.width = img.width;
                    c.height = img.width / scale;
                }
            } else {
                if (c.width != img.height) {
                    var scale = img.width / img.height;
                    c.width = img.height;
                    c.height = img.height * scale;
                }
            }

            var ctx = c.getContext("2d")!;
            if (ctx) {
                if ((this.view == "horizontal" && img.width < img.height) || (this.view == "vertical" && img.width > img.height)) {
                    ctx.translate(c.width / 2, c.height / 2);
                    ctx.rotate(((img.width < img.height ? 270 : 90) * Math.PI) / 180);
                    ctx.translate(-c.height / 2, -c.width / 2);
                }
                ctx.drawImage(img, 0, 0, img.width, img.height);
                ctx.restore();
                ctx.resetTransform();

            }
        }
        img.close();
    }

    protected render() {
        return (
            <canvas ref={"canvasRef"} class={this.view != "vertical" ? s.h_img : s.v_img} />
        );
    }
}

interface IProps {
    device: DeviceInfo;
}