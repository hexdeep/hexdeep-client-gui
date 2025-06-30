import { Component, Prop } from 'vue-property-decorator';
import * as tsx from 'vue-tsx-support';
import './index.less';

type ButtonType = "primary" | "danger";
type ButtonSize = "max" | "medium" | "small" | "mini";

@Component
export class MyButton extends tsx.Component<IPorps, IEvent, ISlots> implements IPorps {
    @Prop() text?: string;
    @Prop() title?: string; // 鼠标悬停显示的text
    @Prop() bgColor?: string;
    @Prop() color?: string;
    @Prop() borderRadius?: string;
    @Prop() plain?: boolean;
    @Prop() type?: ButtonType;
    @Prop() icon?: string;
    @Prop({ default: "small" }) size?: ButtonSize;
    @Prop({ default: "left" }) iconPosition?: "left" | "right";
    @Prop() disabled?: boolean;

    private handleClick() {
        this.$emit('click');
    }

    protected render() {
        return (
            <div
                style={{ backgroundColor: this.bgColor, color: this.color, borderRadius: this.borderRadius }}
                title={this.title}
                class={[
                    'my_button',
                    (!this.type || this.plain) && 'btn_plain',
                    this.size && `size_${this.size}`,
                    this.type && `type_${this.type}`,
                    this.disabled && "disabled",
                ]}
                onClick={() => this.disabled !== true && this.handleClick()}>
                {this.icon && this.iconPosition === "left" && <i class={["iconfont", this.icon]} />}
                {this.$scopedSlots.default ? this.$scopedSlots.default() : this.text}
                {this.icon && this.iconPosition === "right" && <i class={["iconfont", this.icon]} />}
            </div>
        );
    }
}

@Component
export class IconButton extends tsx.Component<IconButtonProps, IEvent, ISlots> {
    @Prop() icon!: string;
    @Prop() borderRadius?: string;
    @Prop() size?: string | number;
    @Prop() iconSize?: string | number;
    @Prop() plain?: boolean;
    @Prop() title?: string;

    private handleClick() {
        this.$emit('click');
    }

    private get _size() {
        if (typeof this.size === "string") {
            return this.size;
        } else if (typeof this.size === "number") {
            return `${this.size}px`;
        } else {
            return "24px";
        }
    }

    private get _iconSize() {
        if (typeof this.iconSize === "string") {
            return this.iconSize;
        } else if (typeof this.iconSize === "number") {
            return `${this.iconSize}px`;
        } else {
            return this.plain ? "18px" : "14px";
        }
    }

    public render() {
        return (
            <MyButton
                icon={this.icon}
                bgColor={this.plain ? 'transparent' : 'var(--main-color,#00849A)'}
                color={this.plain ? "#000" : '#fff'}
                class="my_icon_button"
                title={this.title}
                style={{
                    width: this._size,
                    height: this._size,
                    fontSize: this._iconSize,
                    borderRadius: this.borderRadius,
                    borderColor: this.plain ? 'transparent' : undefined,
                    padding: 0,
                }}
                onClick={this.handleClick}
            />
        );
    }
}

@Component
export class TextButton extends tsx.Component<TextButtonProps, IEvent, ISlots> {
    @Prop() text?: string;
    @Prop() title?: string;
    @Prop() disabled?: boolean;

    public render() {
        return (
            <span class={["textBtn", this.disabled && "disabled"]} title={this.title} onClick={() => this.disabled !== true && this.$emit("click")}> {this.$scopedSlots.default ? this.$scopedSlots.default() : this.text}</span>
        );
    }
}

interface TextButtonProps {
    text?: any;
    title?: string;
    disabled?: boolean;
}

interface IconButtonProps {
    icon: string;
    title?: string;
    size?: number | string;
    iconSize?: number | string;
    borderRadius?: string;
    plain?: boolean;
}

interface IPorps {
    size?: ButtonSize;
    plain?: boolean;
    text?: any;
    title?: string;
    bgColor?: string;
    color?: string;
    borderRadius?: string;
    type?: ButtonType;
    icon?: string;
    iconPosition?: "left" | "right";
    has?: string;
    disabled?: boolean;
}

interface IEvent {
    onClick(): void;
}
interface ISlots {
    default: void;
}