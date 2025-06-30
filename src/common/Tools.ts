export namespace Tool {
    export function getTimeStamp() {
        return Math.round((new Date).getTime() / 1000);
    }

    export function getTimeStampH() {
        return (new Date).getTime();
    }

    export function getFileSize(size: string | number): string {
        if (typeof size == 'string') {
            size = parseInt(size);
        }
        if (!size) return '0';
        let sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        let index = 0;
        while (size > 1024) {
            size /= 1024;
            index++;
        }
        return size.toFixed(2) + sizes[index];
    }


}