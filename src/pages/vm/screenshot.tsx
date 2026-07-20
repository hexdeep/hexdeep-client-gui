import { Component, InjectReactive, Prop, Ref } from 'vue-property-decorator';
import * as tsx from 'vue-tsx-support';
import { deviceApi } from '@/api/device_api';
import s from './dev_list.module.less';
import Vue from 'vue';
import { DeviceInfo, MyConfig } from '@/api/device_define';

interface ScreenshotCacheEntry {
    blob: Blob;
    time: number;
}

@Component
export class Screenshot extends tsx.Component<IProps> {
    private static eventBus = new Vue();
    // 按云机缓存最近一次截图。勾选变化会导致网格重排、Screenshot 组件被销毁重建，
    // 缓存让重建的组件能立即重绘旧图，避免整屏闪烁，同时跳过多余的重复请求。
    private static cache = new Map<string, ScreenshotCacheEntry>();
    public static refresh() {
        this.eventBus.$emit("refresh");
    }
    @InjectReactive() config!: MyConfig;
    @Prop() private device!: DeviceInfo;
    @Ref() private canvasRef!: HTMLCanvasElement;
    private busy = false;

    private get cacheKey(): string {
        return this.device.key ?? this.device.android_sdk;
    }

    protected async created() {
        this.refresh = async () => {
            if (this.device.state != "running") {
                var c = this.canvasRef;
                if (c) {
                    var ctx = c.getContext("2d")!;
                    if (ctx) ctx.clearRect(0, 0, c.width, c.height);
                }
                return;
            }
            if (this.busy) return;
            try {
                this.busy = true;
                var b = await deviceApi.screenshotMacvlan(this.device.android_sdk);
                if (b?.size > 100) {
                    Screenshot.cache.set(this.cacheKey, { blob: b, time: Date.now() });
                    this.updateImg(b);
                }
            } catch (error) {
                // console.error(error);
            } finally {
                this.busy = false;
            }
        };
        Screenshot.eventBus.$on("refresh", this.refresh);

        // 优先使用缓存立即绘制（等 canvas 挂载后），消除重排导致的闪烁；
        // 缓存足够新时直接复用，不再发起网络请求，避免整个列表同时重新拉取截图。
        const cached = Screenshot.cache.get(this.cacheKey);
        if (cached && this.device.state == "running") {
            const freshMs = (this.config?.refreshDuration ?? 15) * 1000;
            this.$nextTick(() => this.updateImg(cached.blob));
            if (Date.now() - cached.time < freshMs) return;
        }
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