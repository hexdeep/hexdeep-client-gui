
declare global {
    interface Number {
        clamp(min: number, max: number): number;
    }
    interface String {
        last(splitStr?: string): string;
    }
}
Number.prototype.clamp = function (min: number, max: number) {
    return Math.max(min, Math.min(max, this as any));
};

String.prototype.last = function (splitStr: string = "_") {
    return this.split(splitStr).last;
};
export { };