import { Component, InjectReactive, Prop, Ref, Watch } from 'vue-property-decorator';
import * as tsx from 'vue-tsx-support';
import { deviceApi } from '@/api/device_api';
import s from './dev_list.module.less';
import Vue from 'vue';
import { DeviceInfo, MyConfig } from '@/api/device_define';

@Component
export class Screenshot extends tsx.Component<IProps> {
    private static eventBus = new Vue();
    public static refresh() {
        this.eventBus.$emit("refresh");
    }
    @InjectReactive() config!: MyConfig;
    @Prop() private device!: DeviceInfo;
    @Ref() private canvasRef!: HTMLCanvasElement;
    private generation = 0;
    private busyGeneration: number | null = null;

    // device.key 只包含 host/index/name，同一实例位删除后重建时可能完全相同。
    // created_at 表示容器代际，用它避免虚拟滚动复用旧云机的 canvas。
    private get deviceInstanceKey(): string {
        return `${this.device.key ?? this.device.android_sdk}|${this.device.created_at}`;
    }

    private get deviceRenderSignature(): string {
        return `${this.deviceInstanceKey}|${this.device.state}`;
    }

    protected async created() {
        this.refresh = async () => {
            if (this.device.state != "running") {
                this.clearCanvas();
                return;
            }

            const generation = this.generation;
            const deviceInstanceKey = this.deviceInstanceKey;
            const androidSdk = this.device.android_sdk;
            if (this.busyGeneration === generation) return;

            try {
                this.busyGeneration = generation;
                const blob = await deviceApi.screenshotMacvlan(androidSdk);
                if (blob?.size > 100 && this.isCurrentDevice(generation, deviceInstanceKey)) {
                    this.updateImg(blob, generation, deviceInstanceKey);
                }
            } catch (error) {
                // console.error(error);
            } finally {
                if (this.busyGeneration === generation) this.busyGeneration = null;
            }
        };
        Screenshot.eventBus.$on("refresh", this.refresh);
        this.refresh();
    }

    protected destroyed() {
        if (this.refresh) Screenshot.eventBus.$off("refresh", this.refresh);
    }

    private refresh!: () => void;

    @Watch("deviceRenderSignature")
    private deviceChanged() {
        this.generation++;
        this.clearCanvas();
        this.refresh();
    }

    private isCurrentDevice(generation: number, deviceInstanceKey: string) {
        return generation === this.generation
            && deviceInstanceKey === this.deviceInstanceKey
            && this.device.state === "running";
    }

    private clearCanvas() {
        const canvas = this.canvasRef;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    private async updateImg(blob: Blob, generation: number, deviceInstanceKey: string) {
        const img = await createImageBitmap(blob);
        if (!img) return;
        if (!this.isCurrentDevice(generation, deviceInstanceKey)) {
            img.close();
            return;
        }
        var c = this.canvasRef;
        if (c) {
            if ((this.config.view == "vertical" && img.width < img.height) || (this.config.view == "horizontal" && img.width > img.height)) {
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
                if ((this.config.view == "horizontal" && img.width < img.height) || (this.config.view == "vertical" && img.width > img.height)) {
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
            <canvas ref={"canvasRef"} class={this.config.view != "vertical" ? s.h_img : s.v_img} />
        );
    }
}

interface IProps {
    device: DeviceInfo;
}
