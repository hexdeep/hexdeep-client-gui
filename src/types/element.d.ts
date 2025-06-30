import { ElMessage } from "element-ui/types/message";
import { ElMessageBoxShortcutMethod } from "element-ui/types/message-box";
import { ElMessageBox } from "element-ui/types/message-box";
import { ElNotification } from "element-ui/types/notification";
declare module 'vue/types/vue' {
    interface Vue {
        /** Used to show feedback after an activity. The difference with Notification is that the latter is often used to show a system level passive notification. */
        $message: ElMessage;
        /** Show a message box */
        $msgbox: ElMessageBox;

        /** Show an alert message box */
        $alert: ElMessageBoxShortcutMethod;

        /** Show a confirm message box */
        $confirm: ElMessageBoxShortcutMethod;

        /** Show a prompt message box */
        $prompt: ElMessageBoxShortcutMethod;

        /** Displays a global notification message at the upper right corner of the page */
        $notify: ElNotification
    }
}