


import { deviceApi } from "@/api/device_api";
import { HostDetailInfo, HostInfo, SDKImagesRes } from "@/api/device_define";
import { Tools } from "@/common/common";
import { i18n } from "@/i18n/i18n";
import { Row } from "@/lib/container";
import { CommonDialog, Dialog } from "@/lib/dialog/dialog";
import { ErrorProxy } from "@/lib/error_handle";
import { MyButton } from "@/lib/my_button";
import { VNode } from "vue";
import { SwitchSDKDialog } from "./switch_sdk";

@Dialog
export class HostDetailDialog extends CommonDialog<HostInfo, void> {
    protected detail: HostDetailInfo = {} as HostDetailInfo;
    protected sdk?: SDKImagesRes;
    protected timer: any;
    override width: string = "600px";
    public override async show(data: HostInfo) {
        this.data = data;
        this.title = this.$t("instance.hostDetail").toString();
        deviceApi.getHostDetail(data.address).then(e => this.detail = e);
        deviceApi.getSDKImages(data.address).then(e => this.sdk = e);
        this.timer = setInterval(() => {
            deviceApi.getHostDetail(data.address).then(e => this.detail = e);
        }, 1000);
        return super.show(data);
    }

    protected destroyed() {
        clearInterval(this.timer);
    }

    protected override renderFooter() {
        // ignore
    }

    protected renderDialog(): VNode {
        return (
            <el-descriptions size="medium" column={1} border labelStyle={{ "width": "120px" }} style={{ padding: "20px" }}>
                <el-descriptions-item label={i18n.t("vmDetail.sdkVersion")}>
                    <Row crossAlign="center">
                        <div style={{ "flex": 1 }}>{this.sdk?.current_version}</div>
                        <Row gap={10}>
                            <MyButton type="primary" size="small" onClick={this.rebootSDK}>{this.$t("vmDetail.rebootSDK")}</MyButton>
                            <MyButton type="primary" size="small" onClick={this.switchSDK}>{this.$t("instance.switchSDK")}</MyButton>
                        </Row>
                    </Row>
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.apiGitCommitId")}>
                    <Row crossAlign="center">
                        {this.detail?.git_commit_id}/{this.sdk?.git_commit_id}
                    </Row>
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.ip")}>
                    <Row crossAlign="center">
                        {this.data.address}
                    </Row>
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.id")}>
                    {this.data.device_id}
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.cpu")}>
                    <el-progress text-inside={true} percentage={this.getPercent(this.detail?.cpu)} stroke-width={26}
                        status={this.getStatus(this.detail?.cpu)}></el-progress>
                </el-descriptions-item>

                <el-descriptions-item label={i18n.t("vmDetail.mem")}>
                    <div alignContent="flex-end" mainAlign="flex-end" crossAlign="end">
                        <el-progress text-inside={true} percentage={this.getPercent(this.detail?.mem_percent)}
                            stroke-width={26} status={this.getStatus(this.detail?.mem_percent)}></el-progress>
                        <div style={{ "text-align": "right" }}>
                            {Tools.getFileSize((this.detail?.mem_total || 0) * this.getPercent(this.detail?.mem_percent) / 100)} / {Tools.getFileSize(this.detail?.mem_total || 0)}
                        </div>
                    </div>
                </el-descriptions-item>

                <el-descriptions-item label={i18n.t("vmDetail.harddisk")}>
                    <div alignContent="flex-end" mainAlign="flex-end" crossAlign="end">
                        <el-progress text-inside={true} percentage={this.getPercent(this.detail?.disk_percent)}
                            stroke-width={26} status={this.getStatus(this.detail?.disk_percent)}></el-progress>
                        <div style={{ "text-align": "right" }}>
                            {Tools.getFileSize((this.detail?.disk_total || 0) * this.getPercent(this.detail?.disk_percent) / 100)} / {Tools.getFileSize(this.detail?.disk_total || 0)}
                        </div>
                    </div>
                </el-descriptions-item>

                <el-descriptions-item label={i18n.t("vmDetail.swap")}>
                    <div alignContent="flex-end" mainAlign="flex-end" crossAlign="end">
                        <el-progress text-inside={true} percentage={this.getPercent(this.detail?.swap_percent)} stroke-width={26} status={this.getStatus(this.detail?.swap_percent)}></el-progress>
                        <div style={{ "text-align": "right" }}>
                            {Tools.getFileSize((this.detail?.swap_total || 0) * this.getPercent(this.detail?.swap_percent) / 100)} / {Tools.getFileSize(this.detail?.swap_total || 0)}
                        </div>
                    </div>
                </el-descriptions-item>

                <el-descriptions-item label={i18n.t("vmDetail.temperature")}>
                    {this.detail?.temperature} ℃
                </el-descriptions-item>
                <el-descriptions-item label={i18n.t("vmDetail.hostOperate")}>
                    <Row crossAlign="center">
                        <Row gap={10}>
                            <MyButton type="primary" size="small" onClick={this.rebootHost}>{this.$t("vmDetail.rebootHost")}</MyButton>
                            <MyButton type="primary" size="small" onClick={this.pruneImages}>{this.$t("vmDetail.pruneImages")}</MyButton>
                        </Row>
                    </Row>
                </el-descriptions-item>
            </el-descriptions>
        );
    }

    @ErrorProxy({ success: i18n.t("vmDetail.rebootSDKSuccess"), loading: i18n.t("loading") })
    private async rebootSDK() {
        await deviceApi.rebootSDK(this.data.address);
    }

    @ErrorProxy({ success: i18n.t("vmDetail.rebootHostSuccess"), loading: i18n.t("loading") })
    private async rebootHost() {
        await deviceApi.rebootHost(this.data.address);
    }

    @ErrorProxy({ success: i18n.t("vmDetail.pruneImagesSuccess"), loading: i18n.t("loading") })
    private async pruneImages() {
        await deviceApi.pruneImages(this.data.address);
    }

    private async switchSDK() {
        await this.$dialog(SwitchSDKDialog).show(this.data);
        deviceApi.getSDKImages(this.data.address).then(e => this.sdk = e);
    }

    private getStatus(percent: string | undefined): string | undefined {
        var re = this.getPercent(percent);
        if (re <= 30) {
            return "success";
        } else if (re <= 60) {
            return undefined;
        } else if (re <= 90) {
            return "warning";

        } else {
            return "exception";
        }
    }
    private getPercent(percent: string | undefined): number {
        if (percent) {
            return parseFloat(percent);
        } else {
            return 0.0;
        }
    }
}