import { RentalInfo } from '@/api/order_define';
import { TextButton } from '@/lib/my_button';
import { VNode } from 'vue';
import { Component, Prop } from "vue-property-decorator";
import * as tsx from 'vue-tsx-support';

type SlotStatus = "normal" | "expiring" | "expired";

const STATUS_ORDER: SlotStatus[] = ["normal", "expiring", "expired"];

const STATUS_META: Record<SlotStatus, {
    labelKey: string;
    selectable: boolean;
    dotClass: string;
    baseClass: string;
    selectedClass: string;
    // 选中后角标对勾的颜色：正常实例位选中后背景是实心绿色，对勾用绿色即可辨认；
    // 即将到期的实例位选中后背景是实心黄色（amber-500），对勾同样跟随黄色，不用绿色，
    // 避免颜色语义和背景色对不上。对勾本身没有背景色块，靠 CHECK_STROKE_STYLE 的白色描边
    // 让笔画在同色的实心背景上也能看清。
    checkClass: string;
}> = {
    normal: {
        labelKey: "create.slotNormal",
        selectable: true,
        dotClass: "bg-green-500",
        baseClass: "border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
        selectedClass: "border-green-600 bg-green-500 text-white",
        checkClass: "text-green-600",
    },
    expiring: {
        labelKey: "create.slotExpiring",
        selectable: true,
        dotClass: "bg-amber-500",
        baseClass: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
        selectedClass: "border-amber-600 bg-amber-500 text-white",
        checkClass: "text-amber-600",
    },
    expired: {
        labelKey: "create.slotExpired",
        selectable: false,
        dotClass: "bg-gray-300",
        baseClass: "border-gray-200 bg-gray-50 text-gray-400",
        selectedClass: "",
        checkClass: "",
    },
};

// 对勾角标的白色描边：8 方向 1px 白色投影叠加，在对勾笔画周围勾出一圈白边，而不是给一个
// 实心圆形背景块——这样即使压在同色的实心选中背景（绿色/黄色）上，笔画本身也能被区分出来。
const CHECK_STROKE_STYLE = {
    textShadow: [
        "-1px -1px 0 #fff", "1px -1px 0 #fff", "-1px 1px 0 #fff", "1px 1px 0 #fff",
        "0 -1px 0 #fff", "0 1px 0 #fff", "-1px 0 0 #fff", "1px 0 0 #fff",
    ].join(", "),
};

/**
 * 实例位多选器：两行六列展示 1-12 号实例位的租期/占用状态，
 * 已到期、已被占用的实例位不可勾选。value/input 实现 v-model<number[]>。
 */
@Component
export class InstanceSlotPicker extends tsx.Component<IProps, IEvents, {}> {
    @Prop({ default: () => [] }) value!: number[];
    @Prop({ default: () => [] }) rentalRecord!: RentalInfo[];

    private getSlotStatus(index: number): SlotStatus {
        const info = this.rentalRecord.find(x => x.index === index);
        if (!info || info.state === "expired") return "expired";
        if (info.state === "expiring") return "expiring";
        return "normal";
    }

    private toggle(index: number) {
        const status = this.getSlotStatus(index);
        if (!STATUS_META[status].selectable) return;
        const next = this.value.includes(index)
            ? this.value.filter(x => x !== index)
            : [...this.value, index];
        this.$emit("input", next);
    }

    // 已付费实例位 = 有租期记录且未到期（normal/expiring），与 STATUS_META 里的 selectable 语义一致
    private allSelectableIndices(): number[] {
        return Array.from({ length: 12 }, (_, i) => i + 1)
            .filter(index => STATUS_META[this.getSlotStatus(index)].selectable);
    }

    private get isAllSelected(): boolean {
        const selectable = this.allSelectableIndices();
        return selectable.length > 0 && selectable.every(index => this.value.includes(index));
    }

    private toggleSelectAll() {
        this.$emit("input", this.isAllSelected ? [] : this.allSelectableIndices());
    }

    private renderLegend() {
        return (
            <div class="mb-2 text-xs text-gray-500">
                <div class="flex items-center gap-4">
                    {STATUS_ORDER.map(status => (
                        <div key={status} class="flex items-center gap-1.5">
                            <span class={["inline-block w-2.5 h-2.5 rounded-sm", STATUS_META[status].dotClass]} />
                            <span>{this.$t(STATUS_META[status].labelKey)}</span>
                        </div>
                    ))}
                </div>
                <div class="flex items-center justify-between gap-2 mt-1.5">
                    <TextButton
                        text={this.$t(this.isAllSelected ? "deselectAll" : "selectAll")}
                        disabled={this.allSelectableIndices().length === 0}
                        onClick={() => this.toggleSelectAll()}
                    />
                    <span class="shrink-0">{this.$t("create.slotSelectedCount", [this.value.length])}</span>
                </div>
            </div>
        );
    }

    private renderSlotButton(index: number) {
        const status = this.getSlotStatus(index);
        const meta = STATUS_META[status];
        const selected = this.value.includes(index);
        return (
            <button
                type="button"
                key={index}
                disabled={!meta.selectable}
                onClick={() => this.toggle(index)}
                class={[
                    "relative flex items-center justify-center rounded-md border text-sm font-medium transition-colors aspect-square",
                    meta.selectable ? "cursor-pointer" : "cursor-not-allowed opacity-70",
                    selected && meta.selectable ? meta.selectedClass : meta.baseClass,
                ]}
            >
                {index}
                {selected && meta.selectable && (
                    <i
                        class={["el-icon-check absolute text-base top-0 right-0 leading-4", meta.checkClass]}
                        style={CHECK_STROKE_STYLE}
                    />
                )}
            </button>
        );
    }

    protected render(): VNode {
        return (
            <div class="w-full">
                {this.renderLegend()}
                <div class="grid grid-cols-6 gap-2">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(index => this.renderSlotButton(index))}
                </div>
            </div>
        );
    }
}

interface IProps {
    value?: number[];
    rentalRecord?: RentalInfo[];
}

interface IEvents {
    onInput: (value: number[]) => void;
}
