export class Completer<T = void> {
    private promise: Promise<T>;
    private resolve!: (value: T) => void;
    private reject!: (reason?: any) => void;
    private onCancel?: () => void;
    public isDone = false;
    constructor(onCancel?: () => void) {
        this.onCancel = onCancel;
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    /**返回一个未来完成的对象 */
    public get future(): Promise<T> {
        return this.promise;
    }

    public complete(v: T) {
        if (!this.isDone) {
            this.isDone = true;
            this.resolve(v);
        }
    }

    public error(err: any) {
        if (!this.isDone) {
            this.isDone = true;
            this.reject(err);
        }
    }

    public cancel() {
        if (!this.isDone) {
            this.isDone = true;
            this.reject('Completer is canceled.');
            if (this.onCancel) this.onCancel();
            this.resolve = undefined as any;
            this.reject = undefined as any;
            this.promise = undefined as any;
        }
    }
}