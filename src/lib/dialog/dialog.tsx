import { Tools } from "@/common/common";
import { Completer } from "@/lib/completer";
import { cloneDeep } from "lodash";
import Vue, { ComponentOptions, CreateElement, VNode, VueConstructor, } from "vue";
import { MyButton } from "../my_button";
import "./dialog.less";
import Component from "vue-class-component";
import { i18n } from "@/i18n/i18n";

export declare type VueClass<V> = {
    new(...args: any[]): V & Vue;
} & typeof Vue;
export declare function componentFactory(Component: VueClass<Vue>, options?: ComponentOptions<Vue>): VueClass<Vue>;

declare module 'vue/types/vue' {
    interface Vue {
        $dialog<T extends { new(): DialogBase<any>; }>(vue: T): InstanceType<T>;

        // $dialog(vue: VNode): any;s
    }
}

export function DialogPlugin(_Vue: typeof Vue) {
    _Vue.prototype.$dialog = function (this: Vue, view: VueConstructor<DialogBase>) {
        const vm = new view({ parent: this });
        // @ts-ignore
        vm.init();
        return vm;
    };
}

/** 基础Dialog 无标题和控制按钮 */
export abstract class DialogBase<TResult = void> extends Vue {
    private _closeing = false;
    public width = "500px";
    public height = "300px";
    public result: any;
    private onKeyup!: (e: KeyboardEvent) => void;
    private completer = new Completer<TResult | undefined>();

    private init() {
        this.onKeyup = (e) => {
            const el = e.target as HTMLElement;
            if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return;
            let elementDialog = document.querySelector(".el-message-box__wrapper[role=dialog]");
            let display = elementDialog?.computedStyleMap().get('display')?.toString();
            console.log(display);
            if (elementDialog && display !== 'none') {
                return;
            }
            if (e.key === "Escape") {
                this.close();
                console.log("esc");
            }
        };
        this.$once("hook:mounted", () => {
            document.addEventListener("keyup", this.onKeyup, { capture: true });
        });
        this.$once("hook:beforeDestroy", () => {
            document.removeEventListener("keyup", this.onKeyup, { capture: true });
        });
    }

    protected render(h: CreateElement): VNode {
        return (
            <div class="dialog" style={{ width: this.width, height: this.height }}>
                {this.renderDialog()}
            </div>
        );
    }

    protected abstract renderDialog(): VNode;

    public show(...args: any[]): Promise<TResult | undefined> {

        if (this.$el) {
            document.body.append(this.$el);
        } else {
            this.onInit();
            const div = document.createElement("div");
            document.body.append(div);
            this.$mount(div);
        }
        document.body.style.overflow = "hidden";
        this.$root.$emit("dialogShow");
        return this.completer.future;
    }

    protected onClosing(): Promise<void> | void { }
    protected onInit() { }

    public async hide() {
        this.$root.$emit("dialogClose");
        await this.onClosing();
        this.$el.remove();
        document.body.style.overflow = "";
    }

    public async close(result?: TResult): Promise<boolean> {
        if (this._closeing) return false;
        try {
            this._closeing = true;
            if (await this.beforeClose()) {
                await this.hide();
                this.$destroy();
                this.onClosed();
                this.completer.complete(result);
                return true;
            }
        } catch (error) {
            throw error;
        } finally {
            this._closeing = false;
        }
        return false;
    }

    protected onClosed() { }

    /**
     * 关闭前的钩子
     * @returns `true`: 关闭 `false`: 不关闭
     */
    protected beforeClose(): Promise<boolean> | boolean {
        return true;
    }
}

/** 通用Dialog 带标题和控制按钮 */
export abstract class CommonDialog<T, TResult = void> extends DialogBase<TResult> {
    public title = "弹窗";
    protected data: T = {} as any;
    protected originData?: T;
    public override height: string = "";
    protected get isEdit() { return !!this.originData; }

    public override show(data?: T): Promise<TResult | undefined> {
        if (data) {
            this.data = cloneDeep(data);
            this.originData = data;
        }
        return super.show();
    }

    protected override render(h: CreateElement): VNode {
        const content = this.renderDialog();
        if (content) {
            if (content.data) {
                content.data.class = ["dialog-content", content.data.class];
            } else {
                content.data = { class: ["dialog-content"] };
            }
        }
        return (
            <div class="dialog-mask">
                <div class="dialog" style={{ width: this.width, height: this.height }}>
                    {this.renderHeader()}
                    {content}
                    {this.renderFooter()}
                </div>
            </div>
        );
    }

    protected renderHeader(): any {
        return (
            <div class="dialog-header">
                <div class="dialog-title">{this.title}</div>
                <div class="dialog-close el-icon-close" onClick={() => this.close()} />
            </div>
        );
    }

    protected renderFooter(): any {
        return (
            <div class="dialog-footer">
                <MyButton text={i18n.t("confirm.ok")} onClick={() => this.onConfirm()} type="primary" />
                <MyButton text={i18n.t("confirm.cancel")} onClick={() => this.close()} />
            </div>
        );
    }

    protected refreshOriginData() {
        if (this.originData) Tools.copyObj(this.data, this.originData);
    }

    protected onConfirm(): any { }

    protected override onClosing() {
        const d = this.$el.querySelector(".dialog");
        if (!d) return;
        return new Promise<void>((resolve) => {
            this.$el.animate([
                { opacity: "1" },
                { opacity: "0" },
            ], { duration: 300 });
            d.animate([
                { transform: "translate(-50%, -50%) scale(1)", opacity: "1" },
                { transform: "translate(-50%, -50%) scale(0)", opacity: "0" },
            ], { duration: 300 }).onfinish = () => {
                resolve();
            };
        });
    }
}

export abstract class DrawerDialog<T, TResult = void> extends CommonDialog<T, TResult> {
    public placement: "left" | "right" = "right";
    public override width = "50%";

    protected override render(h: CreateElement) {
        const content = super.render(h);
        if (content) {
            const classs = ["drawer", this.placement + "-fade-in"];
            if (content.data) {
                content.data.class = [classs, content.data.class];
            } else {
                content.data = { class: classs };
            }
        }
        return content;
    }

    protected override onClosing() {
        const d = this.$el.querySelector(".dialog");
        if (!d) return;
        return new Promise<void>((resolve) => {
            if (this.placement == "left") {
                this.$el.animate([
                    { opacity: "1" },
                    { opacity: "0" }
                ], { duration: 300 });
                d.animate([
                    { transform: "translateX(0)" },
                    { transform: "translateX(-100%)" }
                ], { duration: 300 }).onfinish = () => {
                    resolve();
                };
            } else {
                this.$el.animate([
                    { opacity: "1" },
                    { opacity: "0" }
                ], { duration: 300 });
                d.animate([
                    { transform: "translateX(0)" },
                    { transform: "translateX(100%)" }
                ], { duration: 300 }).onfinish = () => {
                    resolve();
                };
            }
        });
    }
}

export function Dialog<VC extends VueClass<Vue>>(target: VC): VC {
    const parentProto = Object.getPrototypeOf(target.prototype);
    const render = target.prototype.render as Function;
    target.prototype.render = render ?? parentProto.render;
    return Component(target);
}