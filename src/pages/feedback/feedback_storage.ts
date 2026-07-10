const STORAGE_KEY = "feedback_history";

export interface FeedbackHistoryEntry {
    uuid: string;
    /** Date.now()，仅用于本地排序，服务端权威时间以查询结果的 created_at 为准 */
    createdAt: number;
}

// 提交成功后端返回的 uuid 缓存在这里，不需要登录即可在“我的反馈”里找回历史提交
export const feedbackStorage = {
    add(uuid: string) {
        const list = feedbackStorage.getAll();
        if (list.some(e => e.uuid === uuid)) return;
        list.unshift({ uuid, createdAt: Date.now() });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    },

    getAll(): FeedbackHistoryEntry[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    },
};
