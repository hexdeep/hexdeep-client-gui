import { RentalInfo } from '@/api/order_define';
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
    // 避免颜色语义和背景色对不上。角标本身用白底把对勾"抠"出来，不管压在哪种背景色上都能看清。
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

    private renderLegend() {
        return (
            <div class="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-gray-500">
                {STATUS_ORDER.map(status => (
                    <div key={status} class="flex items-center gap-1.5">
                        <span class={["inline-block w-2.5 h-2.5 rounded-sm", STATUS_META[status].dotClass]} />
                        <span>{this.$t(STATUS_META[status].labelKey)}</span>
                    </div>
                ))}
                <div class="flex items-center gap-1.5">
                    <span>{this.$t("create.slotSelectedCount", [this.value.length])}</span>
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
                    <span class={["absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-white shadow", meta.checkClass]}>
                        <i class="el-icon-check" />
                    </span>
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
