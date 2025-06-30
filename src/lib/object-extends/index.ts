declare global {
    interface Array<T> {
        /**获取或设置第一个元素 超出索引会抛出异常 */
        first: T;

        /**获取或设置最后一个元素 超出索引会抛出异常 */
        last: T;

        readonly isEmpty: boolean;
        readonly isNotEmpty: boolean;

        /**移除元素 返回删除是否成功 */
        remove(obj: T): boolean;

        /**移除指定索引元素 返回删除是否成功 */
        removeAt(index: number): boolean;

        /**移除匹配的元素 */
        removeWhere(test: (item: T) => boolean): void;

        /**清空数组 */
        clear(): void;

        /**浅克隆 */
        clone(): Array<T>;

        /**在指定位置插入 */
        insert(obj: T, index?: number): void;

        /**交换元素位置 */
        swap(a: number, b: number): void;

        /**移动元素到指定位置 */
        move(origin: number, target: number): void;

        /**在每个元素中间插入指定元素 */
        joinElement<J>(separator: J): Array<T | J>;

        groupBy<K extends string | number | symbol>(keySelector: (item: T) => K): Record<K, T[]>;

        groupByToMap<K extends string | number | symbol>(keySelector: (item: T) => K): Map<K, T[]>;

        contains(test: (item: T) => boolean): boolean;
    }

    interface ReadonlyArray<T> {
        clone(): Array<T>;
        /**获取第一个元素 超出索引会抛出异常 */
        readonly first: T;

        /**获取最后一个元素 超出索引会抛出异常 */
        readonly last: T;

        readonly isEmpty: boolean;
        readonly isNotEmpty: boolean;
    }

    interface ArrayConstructor {
        generate<T>(length: number, generator: (index: number) => T): Array<T>;
        filled<T>(length: number, fill: T): Array<T>;
    }
}

Array.prototype.contains = function (test: (item: any) => boolean) {
    return this.find(test);
};

Array.prototype.remove = function (obj: any) {
    let index = this.indexOf(obj);
    if (index > -1) {
        this.splice(index, 1);
        return true;
    } else {
        return false;
    }
};
Array.prototype.removeAt = function (index: number) {
    return !!this.splice(index, 1).length;
};
Array.prototype.removeWhere = function (test: (item: any) => boolean) {
    for (let index = this.length - 1; index >= 0; index--) {
        const item = this[index];
        if (test(item)) {
            this.removeAt(index);
        }
    }
};
Array.prototype.clear = function () {
    if (this.length) this.splice(0);
};
Array.prototype.clone = function () {
    return [...this];
};
Array.prototype.insert = function (obj, index) {
    this.splice(index || 0, 0, obj);
};
Array.prototype.swap = function (a, b) {
    this.splice(b, 1, ...this.splice(a, 1, this[b]));
};
Array.prototype.move = function (origin, target) {
    let tem = this.splice(origin, 1);
    this.insert(tem[0], target);
};
Array.prototype.joinElement = function (separator) {
    const ret: any[] = [];
    for (let i = 0, length = this.length; i < length; i++) {
        ret.push(this[i]);
        if (i < length - 1) ret.push(separator);
    }
    return ret;
};
Array.prototype.groupBy = function <K extends string | number | symbol>(keySelector: (item: any) => K): Record<K, any[]> {

    const map: any = {};
    for (const item of this) {
        const key = keySelector(item);
        if (!map[key]) {
            map[key] = [];
        }
        map[key].push(item);
    }
    return map;
};

Array.prototype.groupByToMap = function <K extends string | number | symbol>(keySelector: (item: any) => K): Map<K, any[]> {
    const map = new Map<K, any[]>();
    for (const item of this) {
        const key = keySelector(item);
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key)?.push(item);
    }
    return map;
};

Object.defineProperty(Array.prototype, "first", {
    get: function () {
        return this[0];
    },
    set: function (val) {
        this[0] = val;
    }
});
Object.defineProperty(Array.prototype, "last", {
    get: function () {
        return this[this.length - 1];
    },
    set: function (val) {
        this[this.length - 1] = val;
    }
});
Object.defineProperty(Array.prototype, "isEmpty", {
    get: function () {
        return this.length == 0;
    }
});
Object.defineProperty(Array.prototype, "isNotEmpty", {
    get: function () {
        return this.length > 0;
    }
});
Array.generate = function (length, generator) {
    const ret: any[] = [];
    for (let index = 0; index < length; index++) {
        ret.push(generator(index));
    }
    return ret;
};
Array.filled = function (length, fill) {
    const ret: any[] = [];
    for (let index = 0; index < length; index++) {
        ret.push(fill);
    }
    return ret;
};

export class ArrayLimited<T> {
    public readonly maxLength: number;
    private values: Array<T> = [];

    constructor(maxLength: number) {
        this.maxLength = maxLength;
    }

    /**
     * 从数组创建
     * @param arr 原始数组
     * @param maxLength 若为空则使用```arr.lenght```
     */
    public static fromArray<T>(arr: Array<T>, maxLength?: number) {
        maxLength ??= arr.length;
        let ret = new ArrayLimited<T>(maxLength);
        ret.values = arr.slice(0, maxLength);
        return ret;
    }

    public add(data: T) {
        if (this.values.length >= this.maxLength) {
            this.values.shift();
        }
        this.values.push(data);
    }

    public addFront(data: T) {
        if (this.values.length >= this.maxLength) {
            this.values.pop();
        }
        this.values.unshift(data);
    }

    public get isFilled() {
        return this.values.length === this.maxLength;
    }

    public get items(): ReadonlyArray<T> {
        return [...this.values];
    }

    public get length() {
        return this.values.length;
    }

    public removeAt(index: number, removeAll = false) {
        this.values.splice(index, removeAll ? this.values.length - index : 1);
    }

    public removeLast() {
        this.values.splice(this.values.length - 1, 1);
    }
}
export { };