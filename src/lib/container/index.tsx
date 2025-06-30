import { Component, Prop } from 'vue-property-decorator';
import * as tsx from 'vue-tsx-support';
import Vue from 'vue';

@Component
export class Container extends tsx.Component<IContainerPorpsBase, IEvents, ISlots> {
    @Prop() mainAlign?: MainAlign;
    @Prop() crossAlign?: MainAlign;
    @Prop() wrap?: boolean;
    @Prop() padding?: string | number;
    @Prop() margin?: string | number;
    @Prop() flex?: number;
    @Prop() gap?: string | number;
    @Prop() bgColor?: string;
    @Prop() width?: string | number;
    @Prop() height?: string | number;
    @Prop() flexDirection?: string;
    @Prop() alignContent?: string;
    @Prop() borderRadius?: string | number;
    @Prop() overflow?: "hidden" | "auto" | "scroll";
    @Prop() position?: "relative" | "absolute" | "fixed" | "sticky";

    protected render() {
        return (
            <div
                style={{
                    display: 'flex',
                    justifyContent: this.mainAlign,
                    alignItems: this.crossAlign,
                    flexWrap: this.wrap ? 'wrap' : '',
                    padding: typeof this.padding === 'number' ? `${this.padding}px` : this.padding,
                    margin: typeof this.margin === 'number' ? `${this.margin}px` : this.margin,
                    flex: typeof this.flex === 'boolean' ? 1 : this.flex,
                    gap: typeof this.gap === 'number' ? `${this.gap}px` : this.gap,
                    backgroundColor: this.bgColor,
                    width: typeof this.width === 'number' ? `${this.width}px` : this.width,
                    height: typeof this.height === 'number' ? `${this.height}px` : this.height,
                    flexDirection: this.flexDirection,
                    alignContent: this.alignContent,
                    borderRadius: typeof this.borderRadius === 'number' ? `${this.borderRadius}px` : this.borderRadius,
                    overflow: this.overflow,
                    position: this.position,
                    // minHeight: this.overflow && this.overflow != "hidden" ? 0 : undefined,
                }}>
                {this.$scopedSlots.default ? this.$scopedSlots.default() : null}
            </div>
        );
    }
}

export type MainAlign = "start" | "flex-end" | "end" | "center" | "space-between" | "space-around" | "space-evenly";
export type CrossAlign = "start" | "end" | "center" | "stretch";
export type FlexDirection = "row" | "column";

export interface IContainerPorpsBase {
    mainAlign?: MainAlign;
    crossAlign?: CrossAlign;
    flex?: number | boolean;
    padding?: string | number;
    margin?: string | number;
    wrap?: boolean;
    gap?: string | number;
    bgColor?: string;
    width?: string | number;
    height?: string | number;
    flexDirection?: FlexDirection;
    alignContent?: MainAlign;
    borderRadius?: string | number;
    overflow?: "hidden" | "auto" | "scroll" | "overlay";
    position?: "relative" | "absolute" | "fixed" | "sticky";
}

interface ISlots {
    default?: void;
}

interface IEvents {
    nativeOn?: { [key: string]: Function | Function[]; };
}

@Component
export class Column extends tsx.ofType<
    Omit<IContainerPorpsBase, "flexDirection">,
    IEvents,
    ISlots
>().extendFrom(Container as typeof Vue) {
    @Prop({ default: 'column' }) declare flexDirection: string;
}

@Component
export class Row extends tsx.ofType<
    Omit<IContainerPorpsBase, "flexDirection">,
    IEvents,
    ISlots
>().extendFrom(Container as typeof Vue) {
    @Prop({ default: 'row' }) declare flexDirection: string;
}