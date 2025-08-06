import { cloneDeep } from "lodash";
import moment from "moment";
import { Config } from "./Config";
import urlJoin from "url-join";

export namespace Tools {
    /**将对象a的成员逐个复制到b */
    export function copyObj(a: any, b: any) {
        for (const key in a) {
            if (typeof a[key] === 'object') {
                b[key] = cloneDeep(a[key]);
            } else {
                b[key] = a[key];
            }
        }
    }

    export function getFileSize(size: number): string {
        if (!size) return '0';
        let sizes = ['B', 'K', 'M', 'G', 'T'];
        let index = 0;
        while (size > 1024) {
            size /= 1024;
            index++;
        }
        return size.toFixed(2) + sizes[index];
    }

    export function popFileSelector(acceptType: string) {
        return new Promise<File | undefined>((resolve, reject) => {
            let input = document.createElement('input');
            input.value = '选择文件';
            input.type = 'file';
            input.accept = acceptType;
            input.onchange = event => {
                let file = (event.target as HTMLInputElement)!.files![0];
                if (file.type == acceptType || acceptType.endsWith('*') || acceptType.includes(file.type)) {
                    resolve(file);
                } else {
                    reject('文件格式错误:不支持的文件格式');
                }
            };
            input.click();
            const focus = () => {
                window.removeEventListener("focus", focus);
                setTimeout(() => {
                    resolve(undefined);
                }, 1000);
            };
            window.addEventListener("focus", focus);
        });
    }

    function fakeClick(obj: any) {
        var ev = document.createEvent("MouseEvents");
        ev.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        obj.dispatchEvent(ev);
    }

    export function exportRaw(filename: string, data: string | ArrayBuffer) {
        var save_link = document.createElementNS("http://www.w3.org/1999/xhtml", "a") as any;
        save_link.href = createUrlForData(data);
        save_link.download = filename;
        fakeClick(save_link);
    }

    export function createUrlForData(data: string | ArrayBuffer) {
        var urlObject = window.URL || window.webkitURL || window;
        var export_blob = new Blob([data], { type: "application/bin" });
        return urlObject.createObjectURL(export_blob);
    }

    export function getPx(len?: string | number): string | undefined {
        return typeof len === 'number' && !isNaN(len) ? len + 'px' : len as string | undefined;
    }

    export function buildStyle(styles: Dictionary<any>) {
        for (const key in styles) {
            if (Object.prototype.hasOwnProperty.call(styles, key)) {
                if (typeof styles[key] === 'number') {
                    styles[key] = getPx(styles[key] as any);
                }
            }
        }
        return styles;
    }

    export function str2Regex(inputstring: string) {
        var regParts = inputstring.match(/^\/(.*?)\/([gim]*)$/);
        if (regParts) {
            // the parsed pattern had delimiters and modifiers. handle them. 
            return new RegExp(regParts[1], regParts[2]);
        } else {
            // we got pattern string without delimiters
            return new RegExp(inputstring);
        }
    }

    export async function copyText(text: string) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (error) {
            copyTextFallback(text);
        }
    }

    function copyTextFallback(text: string) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

}

export function sleep(timeout: number) {
    return new Promise<void>(r => setTimeout(() => {
        r();
    }, timeout));
}

export function getObjectKeys<T extends object>(obj: T): (keyof T)[] {
    return Object.keys(obj) as (keyof T)[];
}

export function timeFormat(time: string | Date | number, format = 'yyyy-MM-DD HH:mm:ss') {
    return moment(time).format(format);
}

export function timeDiff(time1: string | Date | number, time2: string | Date | number, unit: moment.unitOfTime.Diff = 'seconds'): number {
    return moment(time1).diff(time2, unit);
}

export function formatTimeByKey(key: string, format = 'yyyy-MM-DD HH:mm:ss') {
    return (row: any) => {
        if (row[key]) {
            return timeFormat(row[key], format);
        } else {
            return "-";
        }
    };
}

export function getSuffixName(e: string) {
    var reg = /.*?[-_]\d*?[-_](?<name>.*)/.exec(e);
    //console.log(reg, reg?.groups?.name);
    return reg?.groups?.name || "";
}

export function getPrefixName(e: string) {
    return /(?<name>.*?[-_]\d*?[-_])/.exec(e)?.groups?.name || "";
}

export function makeVmApiUrl(...url: string[]) {
    return new URL(urlJoin(url), "http://" + url[1]);
}

export function makeMacvlanVmApiUrl(...url: string[]) {
    return new URL(url[0], "http://" + url[1]);
}