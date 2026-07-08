import { HostInfo } from "@/api/device_define";

export interface FeedbackSubmitParam {
    description: string;
    /** 问题相关的机器 */
    machines: HostInfo[];
    sendLog: boolean;
    files: File[];
}
