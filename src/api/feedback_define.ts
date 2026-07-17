import { HostInfo } from "@/api/device_define";

export interface FeedbackSubmitParam {
    description: string;
    /** 问题相关的机器 */
    machines: HostInfo[];
    sendLog: boolean;
    files: File[];
}

export interface FeedbackMessage {
    role: "client" | "admin";
    message: string;
    /** 该消息附带的图片/文件，相对 data 目录的路径数组，用 feedbackApi.messageAttachmentUrl 拼直链 */
    attachments: string[];
    created_at: string;
}

/** /feedback/query_by_uuid 返回的客户可见字段子集，不含 id/source_ip/status/attachments */
export interface FeedbackPublicItem {
    /** 兼容旧版客户端：第一条客户消息的文本，新版请改用 messages */
    description: string;
    machines: string;
    send_log: boolean;
    /** 兼容旧版客户端：第一条管理员消息的文本（可能带升级提示前缀），新版请改用 messages */
    reply: string;
    /** 兼容旧版客户端：第一条管理员消息的附件，新版请改用 messages */
    reply_attachments: string[];
    created_at: string;
    uuid: string;
    /** 完整对话线程，按时间正序排列 */
    messages: FeedbackMessage[];
}
