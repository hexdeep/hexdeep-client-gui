

import { i18n } from "@/i18n/i18n";
import { CommonDialog, Dialog, DrawerDialog } from "@/lib/dialog/dialog";
import { VNode } from "vue";
import { DeviceInfo } from "@/api/device_define";
import { getSuffixName } from "@/common/common";

@Dialog
export class VmDetailDialog extends CommonDialog<DeviceInfo, void> {
    public override width: string = "600px";
    public override show(data: DeviceInfo) {
        this.data = data;
        this.title = this.$t("vmDetail.title").toString();

        return super.show(data);
    }

    protected override renderFooter() {
        // ignore
    }

    protected renderDialog(): VNode {
        return (
            <el-descriptions size="medium" column={1} border labelStyle={{ "width": "120px" }} style={{ padding: "20px" }}>

                <el-descriptions-item label={i18n.t("vmDetail.name")}>
                    {this.data.name}
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.index")}>
                    {this.data.index}
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.data")}>
                    {this.data.data}
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.imageAddr")}>
                    {this.data.image_addr}
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.ip")}>
                    {this.data.ip}
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.adb")}>
                    {this.data.adb}
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.state")}>
                    {i18n.t(this.data.state)}
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.containerGitCommitId")}>
                    {i18n.t(this.data.git_commit_id)}
                </el-descriptions-item>
            </el-descriptions>
        );
    }
}