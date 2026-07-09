import { HostInfo } from "@/api/device_define";

export interface FeedbackSubmitParam {
    description: string;
    /** 问题相关的机器 */
    machines: HostInfo[];
    sendLog: boolean;
    files: File[];
}

/** /feedback/query_by_uuid 返回的客户可见字段子集，不含 id/source_ip/status/attachments */
export interface FeedbackPublicItem {
    description: string;
    machines: string;
    send_log: boolean;
    reply: string;
    created_at: string;
    uuid: string;
}
